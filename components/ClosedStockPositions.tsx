"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface ClosedStockPosition {
  id: string
  symbol: string
  total_quantity: number
  total_cost_basis: number
  total_proceeds: number
  total_realized_pnl: number
  first_buy_date: string
  last_sell_date: string
  trade_count: number
}

export function ClosedStockPositions() {
  const [closedPositions, setClosedPositions] = useState<ClosedStockPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClosedPositions()
  }, [])

  const fetchClosedPositions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/closed-stock-positions')
      
      if (!response.ok) {
        throw new Error('Failed to fetch closed positions')
      }

      const data = await response.json()
      setClosedPositions(data.closedPositions || [])
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading closed positions...</span>
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

  if (closedPositions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>No closed stock positions found.</p>
            <p className="text-sm">Upload a Robinhood CSV to see your closed positions here.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Closed Stock Positions</h2>
        <Badge variant="secondary">
          {closedPositions.length} position{closedPositions.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {closedPositions.map((position) => (
          <Card key={position.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  {position.symbol}
                </CardTitle>
                <Badge 
                  variant={position.total_realized_pnl >= 0 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {position.total_realized_pnl >= 0 ? '+' : ''}{formatCurrency(position.total_realized_pnl)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Quantity:</span>
                  <div className="font-medium">{formatQuantity(position.total_quantity)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Trades:</span>
                  <div className="font-medium">{position.trade_count}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost Basis:</span>
                  <div className="font-medium">{formatCurrency(position.total_cost_basis)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Proceeds:</span>
                  <div className="font-medium">{formatCurrency(position.total_proceeds)}</div>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span>First Buy:</span>
                    <div>{formatDate(position.first_buy_date)}</div>
                  </div>
                  <div>
                    <span>Last Sell:</span>
                    <div>{formatDate(position.last_sell_date)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-medium">Total Realized PnL:</span>
          <span className={`text-lg font-bold ${
            closedPositions.reduce((sum, pos) => sum + pos.total_realized_pnl, 0) >= 0 
              ? 'text-green-600' 
              : 'text-red-600'
          }`}>
            {formatCurrency(closedPositions.reduce((sum, pos) => sum + pos.total_realized_pnl, 0))}
          </span>
        </div>
      </div>
    </div>
  )
} 