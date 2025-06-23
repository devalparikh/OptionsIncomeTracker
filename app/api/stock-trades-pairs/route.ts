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

    // Get all stock trade pairs for this portfolio
    const { data: tradePairs, error: pairsError } = await supabase
      .from('stock_trade_pairs')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('sold_date', { ascending: false })

    if (pairsError) {
      throw new Error(`Failed to fetch trade pairs: ${pairsError.message}`)
    }

    if (!tradePairs || tradePairs.length === 0) {
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

    // Transform trade pairs to match the expected format
    const soldTrades = tradePairs.map(pair => ({
      id: pair.sell_trade_id,
      symbol: pair.symbol,
      open_date: pair.bought_date,
      close_date: pair.sold_date,
      bought_price: pair.bought_price,
      sold_price: pair.sold_price,
      quantity: pair.quantity,
      proceeds: pair.total_proceeds,
      realized_pnl: pair.realized_pnl,
      commissions: pair.commissions,
      positions: {
        symbol: pair.symbol
      }
    }))

    // Calculate summary statistics
    const totalRealizedPnL = soldTrades.reduce((sum, trade) => sum + (trade.realized_pnl || 0), 0)
    const totalProceeds = soldTrades.reduce((sum, trade) => sum + trade.proceeds, 0)
    const totalCommissions = soldTrades.reduce((sum, trade) => sum + (trade.commissions || 0), 0)

    return NextResponse.json({
      stockTrades: [], // Not needed for this endpoint
      soldTrades: soldTrades,
      summary: {
        totalRealizedPnL,
        totalProceeds,
        totalCommissions,
        totalTrades: soldTrades.length,
        soldTradesCount: soldTrades.length
      }
    })

  } catch (error) {
    console.error('Error fetching stock trade pairs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 