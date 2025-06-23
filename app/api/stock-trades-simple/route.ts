import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's portfolio
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    if (accountError || !accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'No account found' }, { status: 400 })
    }

    const accountId = accounts[0].id

    const { data: portfolios, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id')
      .eq('account_id', accountId)
      .limit(1)

    if (portfolioError || !portfolios || portfolios.length === 0) {
      return NextResponse.json({ error: 'No portfolio found' }, { status: 400 })
    }

    const portfolioId = portfolios[0].id

    // First, get all positions for this portfolio
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('id, symbol')
      .eq('portfolio_id', portfolioId)
      .eq('status', 'STOCK')

    if (positionsError) {
      throw new Error(`Failed to fetch positions: ${positionsError.message}`)
    }

    if (!positions || positions.length === 0) {
      return NextResponse.json({
        stockTrades: [],
        soldTrades: [],
        summary: {
          totalRealizedPnL: 0,
          totalProceeds: 0,
          totalCommissions: 0,
          totalTrades: 0,
          soldTradesCount: 0
        }
      })
    }

    const positionIds = positions.map(p => p.id)
    const symbolMap = new Map(positions.map(p => [p.id, p.symbol]))

    // Get all stock trades for these positions
    const { data: stockTrades, error: tradesError } = await supabase
      .from('stock_trades')
      .select('*')
      .in('position_id', positionIds)
      .order('trade_date', { ascending: true })

    if (tradesError) {
      throw new Error(`Failed to fetch stock trades: ${tradesError.message}`)
    }

    // Add symbol information to trades
    const tradesWithSymbols = stockTrades?.map(trade => ({
      ...trade,
      positions: {
        symbol: symbolMap.get(trade.position_id) || 'Unknown'
      }
    })) || []

    // Group trades by position and create buy/sell pairs
    const positionGroups = new Map<string, any[]>()
    
    tradesWithSymbols.forEach(trade => {
      if (!positionGroups.has(trade.position_id)) {
        positionGroups.set(trade.position_id, [])
      }
      positionGroups.get(trade.position_id)!.push(trade)
    })

    // Create sold trades with buy/sell information
    const soldTrades: any[] = []
    
    positionGroups.forEach((trades, positionId) => {
      const symbol = symbolMap.get(positionId) || 'Unknown'
      
      // Separate buy and sell trades
      const buyTrades = trades.filter(t => t.side === 'BUY' && t.is_closed)
      const sellTrades = trades.filter(t => t.side === 'SELL')
      
      // Match sell trades with their corresponding buy trades
      sellTrades.forEach(sellTrade => {
        // Find the buy trade that was closed by this sell trade
        const correspondingBuyTrade = buyTrades.find(buyTrade => 
          buyTrade.close_date === sellTrade.trade_date && 
          buyTrade.close_price === sellTrade.price
        )
        
        if (correspondingBuyTrade) {
          soldTrades.push({
            id: sellTrade.id,
            symbol: symbol,
            open_date: correspondingBuyTrade.trade_date,
            close_date: sellTrade.trade_date,
            bought_price: correspondingBuyTrade.price,
            sold_price: sellTrade.price,
            quantity: sellTrade.quantity,
            proceeds: sellTrade.price * sellTrade.quantity,
            realized_pnl: sellTrade.realized_pnl,
            commissions: sellTrade.commissions || 0,
            positions: {
              symbol: symbol
            }
          })
        } else {
          // Fallback: use the sell trade data if no matching buy trade found
          soldTrades.push({
            id: sellTrade.id,
            symbol: symbol,
            open_date: sellTrade.trade_date, // This will be the same as close_date
            close_date: sellTrade.trade_date,
            bought_price: sellTrade.price, // This will be the same as sold_price
            sold_price: sellTrade.price,
            quantity: sellTrade.quantity,
            proceeds: sellTrade.price * sellTrade.quantity,
            realized_pnl: sellTrade.realized_pnl,
            commissions: sellTrade.commissions || 0,
            positions: {
              symbol: symbol
            }
          })
        }
      })
    })

    // Sort sold trades by close date (most recent first)
    soldTrades.sort((a, b) => new Date(b.close_date).getTime() - new Date(a.open_date).getTime())

    // Calculate summary statistics
    const totalRealizedPnL = soldTrades.reduce((sum, trade) => sum + (trade.realized_pnl || 0), 0)
    const totalProceeds = soldTrades.reduce((sum, trade) => sum + trade.proceeds, 0)
    const totalCommissions = soldTrades.reduce((sum, trade) => sum + (trade.commissions || 0), 0)

    return NextResponse.json({
      stockTrades: tradesWithSymbols,
      soldTrades: soldTrades,
      summary: {
        totalRealizedPnL,
        totalProceeds,
        totalCommissions,
        totalTrades: tradesWithSymbols.length,
        soldTradesCount: soldTrades.length
      }
    })

  } catch (error) {
    console.error('Error fetching stock trades:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 