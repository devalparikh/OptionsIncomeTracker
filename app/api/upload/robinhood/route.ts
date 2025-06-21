import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { RobinhoodCsvParser } from '@/lib/parsers/robinhood-csv';
import { Portfolio as PortfolioModel } from '@/lib/types/portfolio';

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
      .eq('user_id', session.user.id as any)
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

    const account = accounts[0] as any;

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

    const portfolio = portfolios[0] as any;

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
    
    // Parse CSV using the new parser
    const trades = RobinhoodCsvParser.loadCsv(csvText);
    
    if (trades.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or contains no valid trades' },
        { status: 400 }
      );
    }

    // Reverse trades to process in chronological order (oldest first)
    trades.reverse();

    // Create portfolio and load trades
    const portfolioModel = new PortfolioModel();
    portfolioModel.loadShares(trades);
    portfolioModel.loadOptions(trades);

    const results = {
      acceptedRows: trades.length,
      ignoredRows: 0,
      newPositions: 0,
      newLegs: 0,
      warnings: [] as string[],
      realizedPnL: portfolioModel.realizedPnL,
    };

    // Save share positions to database
    for (const [symbol, sharePosition] of portfolioModel.sharePositions) {
      try {
        if (sharePosition.quantity > 0) {
          // Check for existing position
          const { data: existingPositions, error: positionsError } = await supabase
            .from('positions')
            .select('id, quantity, cost_basis')
            .eq('portfolio_id', portfolio.id)
            .eq('symbol', symbol as any)
            .eq('status', 'STOCK' as any);

          if (positionsError) {
            throw positionsError;
          }

          if (existingPositions?.length) {
            // Update existing position
            const existingPosition = existingPositions[0] as any;
            const newQuantity = existingPosition.quantity + sharePosition.quantity;
            const newCostBasis = sharePosition.quantity > 0 
              ? ((existingPosition.cost_basis || 0) * existingPosition.quantity + sharePosition.costBasis * sharePosition.quantity) / newQuantity
              : existingPosition.cost_basis;

            const { error: updateError } = await supabase
              .from('positions')
              .update({
                quantity: newQuantity,
                cost_basis: newCostBasis,
              } as any)
              .eq('id', existingPosition.id);

            if (updateError) {
              throw updateError;
            }
          } else {
            // Create new position
            const { error: insertError } = await supabase
              .from('positions')
              .insert({
                portfolio_id: portfolio.id,
                symbol,
                status: 'STOCK',
                quantity: sharePosition.quantity,
                cost_basis: sharePosition.costBasis,
                current_price: null,
              } as any);

            if (insertError) {
              throw insertError;
            }

            results.newPositions++;
          }
        }
      } catch (error) {
        results.warnings.push(`Error processing share position for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.ignoredRows++;
      }
    }

    // Save options positions to database
    for (const [symbol, optionPosition] of portfolioModel.optionsPositions) {
      try {
        // Create position for options
        const { data: existingPositions, error: positionsError } = await supabase
          .from('positions')
          .select('id')
          .eq('portfolio_id', portfolio.id)
          .eq('symbol', symbol as any)
          .eq('status', 'PUT' as any)
          .limit(1);

        if (positionsError) {
          throw positionsError;
        }

        let positionId: string;

        if (existingPositions?.length) {
          positionId = (existingPositions[0] as any).id;
          
          // Update existing position
          const { error: updateError } = await supabase
            .from('positions')
            .update({
              quantity: optionPosition.quantity,
            } as any)
            .eq('id', positionId as any);

          if (updateError) {
            throw updateError;
          }
        } else {
          // Create new position
          const { data: position, error: positionError } = await supabase
            .from('positions')
            .insert({
              portfolio_id: portfolio.id,
              symbol,
              status: 'PUT',
              quantity: optionPosition.quantity,
              cost_basis: null,
              current_price: null,
            } as any)
            .select('id')
            .single();

          if (positionError) {
            throw positionError;
          }

          if (!position) {
            throw new Error('Failed to create position');
          }

          positionId = (position as any).id;
          results.newPositions++;
        }

        // Create legs for each closed lot
        for (const closedLot of optionPosition.closedLotsData) {
          // Determine the status based on how the leg was closed
          let status = 'CLOSED'; // default status
          let isAssigned = false;
          let isExercised = false;
          
          console.log(`Processing closed lot for ${symbol}:`);
          console.log(`  Original trade type: ${closedLot.originalTrade.type}`);
          console.log(`  Close trade type: ${closedLot.closeTrade.type}`);
          console.log(`  Close trade description: ${closedLot.closeTrade.notes}`);
          
          if (closedLot.closeTrade.type === 'Assignment') {
            status = 'ASSIGNED';
            isAssigned = true;
            console.log(`  Setting status to ASSIGNED`);
          } else if (closedLot.closeTrade.type === 'Expired') {
            status = 'EXPIRED';
            isExercised = true;
            console.log(`  Setting status to EXPIRED`);
          } else if (closedLot.closeTrade.type === 'BTC') {
            status = 'CLOSED';
            console.log(`  Setting status to CLOSED`);
          }
          
          const { error: legError } = await supabase
            .from('legs')
            .insert({
              position_id: positionId,
              side: 'SELL',
              type: closedLot.originalTrade.optionType === 'Call' ? 'CALL' : 'PUT',
              strike: closedLot.originalTrade.strikePrice!,
              expiry: closedLot.originalTrade.expiration!.toISOString().split('T')[0],
              open_date: closedLot.openDate.toISOString().split('T')[0],
              open_price: closedLot.originalTrade.price!,
              close_date: closedLot.closeDate.toISOString().split('T')[0],
              close_price: closedLot.closeTrade.type === 'BTC' ? closedLot.closeTrade.price! : 0,
              contracts: closedLot.originalTrade.quantity!,
              commissions: 0,
              is_assigned: isAssigned,
              is_exercised: isExercised,
              share_cost_basis: null,
            } as any);

          if (legError) {
            results.warnings.push(`Error creating leg for ${symbol}: ${legError.message}`);
          } else {
            results.newLegs++;
          }
        }

        // Create legs for remaining open lots (if any)
        if (optionPosition.quantity > 0) {
          // For open positions, we need to create legs for the remaining contracts
          // This is a simplified approach - in a full implementation, you'd track each contract separately
          results.warnings.push(`Open option position for ${symbol} created but individual open legs not yet implemented`);
        }

      } catch (error) {
        results.warnings.push(`Error processing option position for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.ignoredRows++;
      }
    }

    // Convert Maps to plain objects for JSON serialization
    const sharePositions = Object.fromEntries(
      Array.from(portfolioModel.sharePositions.entries()).map(([symbol, position]) => [
        symbol,
        {
          symbol: position.symbol,
          quantity: position.quantity,
          costBasis: position.costBasis,
          realizedPnL: position.realizedPnL,
        }
      ])
    );

    const openOptionsPositions = Object.fromEntries(
      Array.from(portfolioModel.openOptionsPositions.entries()).map(([symbol, position]) => [
        symbol,
        {
          symbol: position.symbol,
          quantity: position.quantity,
          totalCredit: position.totalCredit,
          realizedPnL: position.realizedPnL,
          isClosed: position.isClosed,
          closedLotsCount: position.closedLotsCount,
          totalContractsClosed: position.totalContractsClosed,
          closedLots: position.closedLotsData.map(lot => ({
            date: lot.closeDate,
            symbol: lot.originalTrade.symbol,
            type: lot.closeTrade.type,
            quantity: lot.originalTrade.quantity,
            price: lot.closeTrade.price,
            underlying: lot.originalTrade.underlying,
            expiration: lot.originalTrade.expiration,
            strikePrice: lot.originalTrade.strikePrice,
            optionType: lot.originalTrade.optionType,
            notes: lot.closeTrade.notes,
          })),
        }
      ])
    );

    const closedOptionsPositions = Object.fromEntries(
      Array.from(portfolioModel.closedOptionsPositions.entries()).map(([symbol, position]) => [
        symbol,
        {
          symbol: position.symbol,
          quantity: position.quantity,
          totalCredit: position.totalCredit,
          realizedPnL: position.realizedPnL,
          isClosed: position.isClosed,
          closedLotsCount: position.closedLotsCount,
          totalContractsClosed: position.totalContractsClosed,
          closedLots: position.closedLotsData.map(lot => ({
            date: lot.closeDate,
            symbol: lot.originalTrade.symbol,
            type: lot.closeTrade.type,
            quantity: lot.originalTrade.quantity,
            price: lot.closeTrade.price,
            underlying: lot.originalTrade.underlying,
            expiration: lot.originalTrade.expiration,
            strikePrice: lot.originalTrade.strikePrice,
            optionType: lot.originalTrade.optionType,
            notes: lot.closeTrade.notes,
          })),
        }
      ])
    );

    const finalResults = {
      ...results,
      sharePositions,
      openOptionsPositions,
      closedOptionsPositions,
      trades: trades.map(trade => ({
        date: trade.date,
        symbol: trade.symbol,
        type: trade.type,
        quantity: trade.quantity,
        price: trade.price,
        isOption: trade.isOption,
        underlying: trade.underlying,
        expiration: trade.expiration,
        strikePrice: trade.strikePrice,
        optionType: trade.optionType,
      })),
    };

    return NextResponse.json(finalResults);
  } catch (error) {
    console.error('Error processing CSV upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 