import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { db } from '@/lib/db';
import { OptionPositions, OptionTransactions } from '@/types/db';

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

// Schema for parsed option data
const OptionDataSchema = z.object({
  symbol: z.string(),
  expiryDate: z.string(),
  optionType: z.enum(['Call', 'Put']),
  strikePrice: z.number(),
  quantity: z.number(),
  openDate: z.string(),
  openPrice: z.number(),
  premiumTotal: z.number(),
});

// Regular expression to parse option description
const OPTION_DESC_REGEX = /^([A-Z]+) (\d{1,2}\/\d{1,2}\/\d{4}) (Call|Put) \$([0-9.]+)$/;

export async function POST(request: Request) {
  try {
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

        // Create option position
        const position = await db.optionPositions.create({
          data: {
            symbol,
            strikePrice: parseFloat(strikePrice),
            expiryDate: new Date(expiryDate),
            type: optionType.toUpperCase(),
            openDate: new Date(validatedRow['Activity Date']),
            openPrice: price,
            contracts: quantity,
            premiumTotal,
          },
        });

        // Record the transaction
        await db.optionTransactions.create({
          data: {
            positionId: position.id,
            action: 'STO',
            tradeDate: new Date(validatedRow['Activity Date']),
            pricePerShare: price,
            totalCash: premiumTotal,
          },
        });

        results.acceptedRows++;
        results.newPositions++;
      } catch (error) {
        if (error instanceof z.ZodError) {
          results.warnings.push(`Invalid row format: ${error.message}`);
        } else {
          results.warnings.push(`Error processing row: ${error.message}`);
        }
        results.ignoredRows++;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error processing CSV upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 