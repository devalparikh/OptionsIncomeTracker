"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'

interface StockTrade {
  id: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  trade_date: string
  close_date?: string
  close_price?: number
  realized_pnl: number
  is_closed: boolean
  commissions: number
  positions: {
    symbol: string
  }
  open_date?: string
  bought_price?: number
  sold_price?: number
  proceeds?: number
}

interface StockTradesData {
  stockTrades: StockTrade[]
  soldTrades: StockTrade[]
  summary: {
    totalRealizedPnL: number
    totalProceeds: number
    totalCommissions: number
    totalTrades: number
    soldTradesCount: number
  }
}

export function StockTradesTable() {
  const [data, setData] = useState<StockTradesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStockTrades()
  }, [])

  const fetchStockTrades = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/stock-trades-pairs')
      
      if (!response.ok) {
        throw new Error('Failed to fetch stock trades')
      }

      const tradesData = await response.json()
      setData(tradesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatQuantity = (quantity: number) => {
    return quantity.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    })
  }

  const formatPercentage = (pnl: number, proceeds: number) => {
    if (proceeds === 0) return '0.00%'
    const percentage = (pnl / proceeds) * 100
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading stock trades...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.soldTrades.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>No sold stock trades found.</p>
            <p className="text-sm">Upload a Robinhood CSV to see your trading history here.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Realized PnL</CardTitle>
            {data.summary.totalRealizedPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              data.summary.totalRealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(data.summary.totalRealizedPnL)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Proceeds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.summary.totalProceeds)}
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {formatCurrency(data.summary.totalCommissions)}
            </div>
          </CardContent>
        </Card> */}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sold Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.soldTradesCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sold Stock Trades</span>
            <Badge variant="secondary">
              {data.soldTrades.length} trade{data.soldTrades.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Open Date</TableHead>
                  <TableHead>Close Date</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Bought Price</TableHead>
                  <TableHead className="text-right">Sold Price</TableHead>
                  <TableHead className="text-right">Proceeds</TableHead>
                  <TableHead className="text-right">Realized PnL</TableHead>
                  <TableHead className="text-right">Return %</TableHead>
                  <TableHead className="text-right">Commissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.soldTrades.map((trade) => {
                  const returnPercentage = formatPercentage(trade.realized_pnl, trade.proceeds || 0)
                  
                  return (
                    <TableRow key={trade.id}>
                      <TableCell className="font-medium">
                        {trade.positions.symbol}
                      </TableCell>
                      <TableCell>
                        {trade.open_date ? formatDate(trade.open_date) : '-'}
                      </TableCell>
                      <TableCell>
                        {trade.close_date ? formatDate(trade.close_date) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(trade.quantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        {trade.bought_price !== undefined && trade.bought_price !== null ? formatCurrency(trade.bought_price) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {trade.sold_price !== undefined && trade.sold_price !== null ? formatCurrency(trade.sold_price) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(trade.proceeds || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={trade.realized_pnl >= 0 ? "outline" : "destructive"}
                          className={`text-xs ${trade.realized_pnl >= 0 ? 'text-green-600 border-green-600' : ''}`}
                        >
                          {trade.realized_pnl >= 0 ? '+' : ''}{formatCurrency(trade.realized_pnl)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={trade.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {returnPercentage}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(trade.commissions || 0)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.soldTrades.filter(t => t.realized_pnl > 0).length}
              </div>
              <div className="text-sm text-muted-foreground">Profitable Trades</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {data.soldTrades.filter(t => t.realized_pnl < 0).length}
              </div>
              <div className="text-sm text-muted-foreground">Losing Trades</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {data.soldTrades.length > 0 
                  ? Math.round((data.soldTrades.filter(t => t.realized_pnl > 0).length / data.soldTrades.length) * 100)
                  : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Win Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 