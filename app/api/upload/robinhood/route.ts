import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { RobinhoodCsvParser } from '@/lib/parsers/robinhood-csv'
import { ActivityType } from '@/lib/types/trade'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type and size
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload a CSV file.' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      return NextResponse.json({ error: 'File too large. Maximum size is 2MB.' }, { status: 400 })
    }

    // Read file content
    const csvText = await file.text()

    // Parse CSV using existing parser
    const trades = RobinhoodCsvParser.loadCsv(csvText)
    
    if (trades.length === 0) {
      return NextResponse.json({ error: 'No valid trades found in CSV' }, { status: 400 })
    }

    // Get user's default portfolio
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    if (accountError || !accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'No account found. Please create an account first.' }, { status: 400 })
    }

    const accountId = accounts[0].id

    const { data: portfolios, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id')
      .eq('account_id', accountId)
      .limit(1)

    if (portfolioError || !portfolios || portfolios.length === 0) {
      return NextResponse.json({ error: 'No portfolio found. Please create a portfolio first.' }, { status: 400 })
    }

    const portfolioId = portfolios[0].id

    // Process trades and store in database
    const result = await processTrades(trades, portfolioId, supabase)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error processing Robinhood CSV upload:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processTrades(
  trades: any[],
  portfolioId: string,
  supabase: any
): Promise<{
  acceptedRows: number
  ignoredRows: number
  newPositions: number
  warnings: string[]
}> {
  const warnings: string[] = []
  let acceptedRows = 0
  let ignoredRows = 0
  let newPositions = 0

  // Sort trades by date (oldest first)
  trades.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Track open positions for matching closes
  const openPositions = new Map<string, any>()

  for (const trade of trades) {
    try {
      if (!trade.symbol || !trade.date) {
        ignoredRows++
        continue
      }

      acceptedRows++

      if (trade.isOption) {
        // Handle option trades
        const positionKey = `${trade.symbol}_${trade.expiration?.toISOString().split('T')[0]}_${trade.strikePrice}_${trade.optionType}`
        
        switch (trade.type) {
          case ActivityType.STO: // Sell to Open
            await createOptionPosition(trade, portfolioId, supabase)
            openPositions.set(positionKey, trade)
            newPositions++
            break

          case ActivityType.BTC: // Buy to Close
            await closeOptionPosition(trade, portfolioId, supabase, openPositions)
            break

          case ActivityType.Expired: // Expired worthless
            await closeOptionPosition(trade, portfolioId, supabase, openPositions, true)
            break

          case ActivityType.Assignment: // Assignment
            await handleAssignment(trade, portfolioId, supabase, openPositions)
            break

          default:
            ignoredRows++
            warnings.push(`Unhandled option activity type: ${trade.type} for ${trade.symbol}`)
        }
      } else {
        // Handle stock trades
        switch (trade.type) {
          case ActivityType.Buy:
            await createOrUpdateStockPosition(trade, portfolioId, supabase, true)
            break

          case ActivityType.Sell:
            await createOrUpdateStockPosition(trade, portfolioId, supabase, false)
            break

          default:
            ignoredRows++
            warnings.push(`Unhandled stock activity type: ${trade.type} for ${trade.symbol}`)
        }
      }
    } catch (error) {
      console.error('Error processing trade:', trade, error)
      warnings.push(`Error processing trade: ${trade.symbol} ${trade.type} - ${error instanceof Error ? error.message : 'Unknown error'}`)
      ignoredRows++
    }
  }

  return {
    acceptedRows,
    ignoredRows,
    newPositions,
    warnings
  }
}

async function createOptionPosition(trade: any, portfolioId: string, supabase: any) {
  // Use exact quantity (supports fractional contracts)
  const quantity = trade.quantity || 0
  
  // Create position first
  const { data: position, error: positionError } = await supabase
    .from('positions')
    .insert({
      portfolio_id: portfolioId,
      symbol: trade.symbol,
      status: trade.optionType?.toUpperCase(),
      quantity: quantity,
      cost_basis: null,
      current_price: null,
    })
    .select('id')
    .single()

  if (positionError) {
    throw new Error(`Failed to create position: ${positionError.message}`)
  }

  if (!position) {
    throw new Error('Failed to create position: No data returned')
  }

  // Create leg
  const { error: legError } = await supabase
    .from('legs')
    .insert({
      position_id: position.id,
      side: 'SELL', // STO is always sell
      type: trade.optionType?.toUpperCase(),
      strike: trade.strikePrice,
      expiry: trade.expiration?.toISOString().split('T')[0],
      open_date: trade.date.toISOString().split('T')[0],
      open_price: trade.price || 0,
      contracts: quantity,
      commissions: 0, // Could be calculated from amount vs price*quantity
      is_assigned: false,
      is_exercised: false,
    })

  if (legError) {
    throw new Error(`Failed to create leg: ${legError.message}`)
  }
}

async function closeOptionPosition(
  trade: any, 
  portfolioId: string, 
  supabase: any, 
  openPositions: Map<string, any>,
  isExpired = false
) {
  const positionKey = `${trade.symbol}_${trade.expiration?.toISOString().split('T')[0]}_${trade.strikePrice}_${trade.optionType}`
  
  // Find the open leg to close
  const { data: legs, error: legError } = await supabase
    .from('legs')
    .select(`
      id,
      position_id,
      open_price,
      contracts,
      side,
      commissions,
      positions!inner(portfolio_id, symbol, status)
    `)
    .eq('positions.portfolio_id', portfolioId)
    .eq('positions.symbol', trade.symbol)
    .eq('type', trade.optionType?.toUpperCase())
    .eq('strike', trade.strikePrice)
    .eq('expiry', trade.expiration?.toISOString().split('T')[0])
    .eq('side', 'SELL')
    .is('close_date', null)
    .is('is_assigned', false)
    .is('is_exercised', false)

  if (legError) {
    throw new Error(`Failed to find open leg: ${legError.message}`)
  }

  if (!legs || legs.length === 0) {
    throw new Error(`No open position found to close for ${trade.symbol}`)
  }

  // Close the leg
  const leg = legs[0]
  
  // Determine close type based on trade type
  let closeType: 'BTC' | 'EXPIRED' | 'ASSIGNED' | 'EXERCISED' | null = null
  if (trade.type === ActivityType.BTC) {
    closeType = 'BTC'
  } else if (trade.type === ActivityType.Expired) {
    closeType = 'EXPIRED'
  } else if (trade.type === ActivityType.Assignment) {
    closeType = 'ASSIGNED'
  }

  // Calculate realized PnL
  const openPremium = leg.open_price * 100 * leg.contracts
  let closeCost = 0
  let realizedPnL = 0

  if (trade.type === ActivityType.Expired) {
    // For expired contracts, close_price is typically 0 or null
    // Realized PnL is the full premium received (since option expired worthless)
    closeCost = 0
    realizedPnL = leg.side === 'SELL' 
      ? openPremium - (leg.commissions || 0)  // Keep full premium minus commissions
      : -(leg.commissions || 0)  // Long options that expire worthless lose the premium paid
  } else {
    // For BTC or Assignment, use the actual close price
    closeCost = (trade.price || 0) * 100 * leg.contracts
    realizedPnL = leg.side === 'SELL' 
      ? openPremium - closeCost - (leg.commissions || 0)
      : closeCost - openPremium - (leg.commissions || 0)
  }

  const { error: updateError } = await supabase
    .from('legs')
    .update({
      close_date: trade.date.toISOString().split('T')[0],
      close_price: trade.price || 0,
      close_type: closeType,
      realized_pnl: realizedPnL,
      is_assigned: trade.type === ActivityType.Assignment,
      is_exercised: trade.type === ActivityType.Expired,
    })
    .eq('id', leg.id)

  if (updateError) {
    throw new Error(`Failed to close leg: ${updateError.message}`)
  }

  // Remove from open positions
  openPositions.delete(positionKey)
}

async function handleAssignment(trade: any, portfolioId: string, supabase: any, openPositions: Map<string, any>) {
  // For assignments, we need to handle both the option assignment and potential stock delivery
  await closeOptionPosition(trade, portfolioId, supabase, openPositions, false)
  
  // If this is a call assignment, we might need to handle stock delivery
  if (trade.optionType === 'Call') {
    // The stock delivery would be handled in a separate trade entry
    // This is just the option assignment marker
  }
}

async function createOrUpdateStockPosition(trade: any, portfolioId: string, supabase: any, isBuy: boolean) {
  // Use exact quantity (supports fractional shares)
  const quantity = trade.quantity || 0
  
  // Check if position exists
  const { data: existingPosition, error: selectError } = await supabase
    .from('positions')
    .select('id, quantity, cost_basis')
    .eq('portfolio_id', portfolioId)
    .eq('symbol', trade.symbol)
    .eq('status', 'STOCK')
    .maybeSingle()

  if (selectError) {
    throw new Error(`Failed to check existing position: ${selectError.message}`)
  }

  if (isBuy) {
    // Buying stock
    if (existingPosition) {
      // Update existing position with weighted average cost basis
      const existingQuantity = existingPosition.quantity || 0
      const existingCostBasis = existingPosition.cost_basis || 0
      const newQuantity = quantity
      const newCostBasis = trade.price || 0
      
      const totalQuantity = existingQuantity + newQuantity
      const weightedCostBasis = existingQuantity > 0
        ? ((existingQuantity * existingCostBasis) + (newQuantity * newCostBasis)) / totalQuantity
        : newCostBasis

      const { error: updateError } = await supabase
        .from('positions')
        .update({
          quantity: totalQuantity,
          cost_basis: weightedCostBasis,
        })
        .eq('id', existingPosition.id)

      if (updateError) {
        throw new Error(`Failed to update position: ${updateError.message}`)
      }
    } else {
      // Create new position
      const { error: insertError } = await supabase
        .from('positions')
        .insert({
          portfolio_id: portfolioId,
          symbol: trade.symbol,
          status: 'STOCK',
          quantity: quantity,
          cost_basis: trade.price || 0,
          current_price: null,
        })

      if (insertError) {
        throw new Error(`Failed to create position: ${insertError.message}`)
      }
    }
  } else {
    // Selling stock
    if (existingPosition) {
      const remainingQuantity = (existingPosition.quantity || 0) - quantity
      
      if (remainingQuantity < 0) {
        throw new Error(`Insufficient shares to sell for ${trade.symbol}`)
      }

      // Calculate realized PnL for the sold shares
      const soldQuantity = quantity
      const costBasis = existingPosition.cost_basis || 0
      const salePrice = trade.price || 0
      const realizedPnL = (salePrice - costBasis) * soldQuantity

      const { error: updateError } = await supabase
        .from('positions')
        .update({
          quantity: remainingQuantity,
          // Keep the same cost basis for remaining shares
        })
        .eq('id', existingPosition.id)

      if (updateError) {
        throw new Error(`Failed to update position: ${updateError.message}`)
      }

      // Note: In a more sophisticated implementation, you might want to track realized PnL
      // at the portfolio level or in a separate trades table. For now, we're just
      // calculating it but not storing it since the positions table doesn't have
      // a realized_pnl field for stocks.
      
      console.log(`Realized PnL for ${trade.symbol} sale: $${realizedPnL.toFixed(2)}`)
    } else {
      throw new Error(`No position found to sell for ${trade.symbol}`)
    }
  }
} 