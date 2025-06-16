import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type Portfolio = Database['public']['Tables']['portfolios']['Row'];
type Position = Database['public']['Tables']['positions']['Row'];
type PositionInsert = Database['public']['Tables']['positions']['Insert'];
type Leg = Database['public']['Tables']['legs']['Row'];
type LegInsert = Database['public']['Tables']['legs']['Insert'];

// Schema for validating Robinhood CSV row
const RobinhoodRowSchema = z.object({
  'Activity Date': z.string(),
  'Process Date': z.string(),
  'Settle Date': z.string(),
  'Instrument': z.string(),
  'Description': z.string(),
  'Trans Code': z.string(),
  'Quantity': z.string(),
  'Price': z.string(),
  'Amount': z.string(),
});

// Regular expression to parse option description
const OPTION_DESC_REGEX = /^([A-Z]+) (\d{1,2}\/\d{1,2}\/\d{4}) (Call|Put) \$([0-9.]+)$/;

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    // Get user's session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's default portfolio
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1);

    if (accountsError) {
      throw accountsError;
    }

    if (!accounts?.length) {
      return NextResponse.json(
        { error: 'No account found' },
        { status: 400 }
      );
    }

    const account = accounts[0];

    const { data: portfolios, error: portfoliosError } = await supabase
      .from('portfolios')
      .select('id')
      .eq('account_id', account.id)
      .limit(1);

    if (portfoliosError) {
      throw portfoliosError;
    }

    if (!portfolios?.length) {
      return NextResponse.json(
        { error: 'No portfolio found' },
        { status: 400 }
      );
    }

    const portfolio = portfolios[0];

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type and size
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      return NextResponse.json(
        { error: 'File size must be less than 2MB' },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    });

    // Validate CSV structure
    if (records.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Validate required columns
    const firstRow = records[0];
    const requiredColumns = [
      'Activity Date',
      'Instrument',
      'Description',
      'Trans Code',
      'Quantity',
      'Price',
    ];

    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missingColumns.join(', ')}` },
        { status: 400 }
      );
    }

    const results = {
      acceptedRows: 0,
      ignoredRows: 0,
      newPositions: 0,
      warnings: [] as string[],
    };

    // Process each row
    for (const row of records) {
      try {
        const validatedRow = RobinhoodRowSchema.parse(row);
        
        // Only process STO (Sell to Open) transactions
        if (validatedRow['Trans Code'] !== 'STO') {
          results.ignoredRows++;
          continue;
        }

        // Parse option description
        const match = validatedRow.Description.match(OPTION_DESC_REGEX);
        if (!match) {
          results.warnings.push(`Invalid option description format: ${validatedRow.Description}`);
          results.ignoredRows++;
          continue;
        }

        const [, symbol, expiryDate, optionType, strikePrice] = match;
        const quantity = parseInt(validatedRow.Quantity);
        const price = parseFloat(validatedRow.Price.replace(/[$,()]/g, ''));
        const premiumTotal = price * 100 * quantity;

        // Map option type to position status
        const positionStatus = optionType.toUpperCase() === 'PUT' ? 'PUT' : 'CALL';
        const legType = optionType.toUpperCase() === 'PUT' ? 'PUT' : 'CALL';
        const legSide = 'SELL';

        // Check for existing position
        const { data: existingPositions, error: positionsError } = await supabase
          .from('positions')
          .select('id')
          .eq('portfolio_id', portfolio.id)
          .eq('symbol', symbol)
          .eq('status', positionStatus);

        if (positionsError) {
          throw positionsError;
        }

        let positionId: string;

        if (existingPositions?.length) {
          positionId = existingPositions[0].id;
        } else {
          // Create new position
          const { data: position, error: positionError } = await supabase
            .from('positions')
            .insert({
              portfolio_id: portfolio.id,
              symbol,
              status: positionStatus,
              quantity: 0, // Will be updated by leg
              cost_basis: null,
              current_price: null,
            })
            .select('id')
            .single();

          if (positionError) {
            throw positionError;
          }

          if (!position) {
            throw new Error('Failed to create position');
          }

          positionId = position.id;
        }

        // Check for existing leg
        const { data: existingLegs, error: legsError } = await supabase
          .from('legs')
          .select('id')
          .eq('position_id', positionId)
          .eq('type', legType)
          .eq('strike', parseFloat(strikePrice))
          .eq('expiry', expiryDate)
          .eq('open_date', validatedRow['Activity Date']);

        if (legsError) {
          throw legsError;
        }

        if (existingLegs?.length) {
          results.warnings.push(
            `Skipped duplicate leg: ${symbol} ${optionType} ${strikePrice} ${expiryDate}`
          );
          results.ignoredRows++;
          continue;
        }

        // Create new leg
        const { error: legError } = await supabase
          .from('legs')
          .insert({
            position_id: positionId,
            side: legSide,
            type: legType,
            strike: parseFloat(strikePrice),
            expiry: expiryDate,
            open_date: validatedRow['Activity Date'],
            open_price: price,
            contracts: quantity,
            commissions: 0, // Robinhood doesn't charge commissions
            is_assigned: false,
            is_exercised: false,
            share_cost_basis: null,
          });

        if (legError) {
          throw legError;
        }

        // Update position quantity
        const { error: updateError } = await supabase
          .from('positions')
          .update({ quantity: quantity })
          .eq('id', positionId);

        if (updateError) {
          throw updateError;
        }

        results.acceptedRows++;
        results.newPositions++;
      } catch (error) {
        if (error instanceof z.ZodError) {
          results.warnings.push(`Invalid row format: ${error.message}`);
        } else if (error instanceof Error) {
          results.warnings.push(`Error processing row: ${error.message}`);
        } else {
          results.warnings.push('Unknown error processing row');
        }
        results.ignoredRows++;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error processing CSV upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 