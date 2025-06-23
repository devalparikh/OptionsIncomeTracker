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

    // Get closed stock positions
    const { data: closedPositions, error: closedError } = await supabase
      .from('closed_stock_positions')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('last_sell_date', { ascending: false })

    if (closedError) {
      throw new Error(`Failed to fetch closed positions: ${closedError.message}`)
    }

    return NextResponse.json({
      closedPositions: closedPositions || []
    })

  } catch (error) {
    console.error('Error fetching closed stock positions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 