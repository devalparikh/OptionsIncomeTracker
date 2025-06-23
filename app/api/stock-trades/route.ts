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

    // Get all stock trades with position and symbol information
    const { data: stockTrades, error: tradesError } = await supabase
      .from('stock_trades')
      .select(`
        id,
        side,
        quantity,
        price,
        trade_date,
        close_date,
        close_price,
        realized_pnl,
        is_closed,
        commissions,
        created_at,
        position_id,
        positions!inner(
          symbol,
          portfolio_id
        )
      `)
      .eq('positions.portfolio_id', portfolioId)
      .order('trade_date', { ascending: false })

    if (tradesError) {
      throw new Error(`Failed to fetch stock trades: ${tradesError.message}`)
    }

    // Get sold trades specifically (for PnL display)
    const soldTrades = stockTrades?.filter(trade => trade.side === 'SELL') || []

    // Calculate summary statistics
    const totalRealizedPnL = soldTrades.reduce((sum, trade) => sum + (trade.realized_pnl || 0), 0)
    const totalProceeds = soldTrades.reduce((sum, trade) => sum + (trade.price * trade.quantity), 0)
    const totalCommissions = soldTrades.reduce((sum, trade) => sum + (trade.commissions || 0), 0)

    return NextResponse.json({
      stockTrades: stockTrades || [],
      soldTrades: soldTrades,
      summary: {
        totalRealizedPnL,
        totalProceeds,
        totalCommissions,
        totalTrades: stockTrades?.length || 0,
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