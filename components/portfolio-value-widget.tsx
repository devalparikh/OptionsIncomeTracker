"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { TrendingUp, TrendingDown, DollarSign, PieChart, Eye, EyeOff, ChevronDown, Shield } from "lucide-react"
import type { PortfolioValue } from "@/utils/portfolio-calculations"

interface PortfolioValueWidgetProps {
  portfolioValue: PortfolioValue
  loading?: boolean
  onRefresh?: () => void
}

export function PortfolioValueWidget({ portfolioValue, loading, onRefresh }: PortfolioValueWidgetProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showStockDetails, setShowStockDetails] = useState(false)
  const [previousValue, setPreviousValue] = useState<number | null>(null)

  useEffect(() => {
    if (previousValue === null) {
      setPreviousValue(portfolioValue.totalPortfolioValue)
    }
  }, [portfolioValue.totalPortfolioValue, previousValue])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
  }

  const getChangeColor = (value: number) => {
    if (value > 0) return "text-green-600"
    if (value < 0) return "text-red-600"
    return "text-muted-foreground"
  }

  const getChangeIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4" />
    if (value < 0) return <TrendingDown className="h-4 w-4" />
    return <DollarSign className="h-4 w-4" />
  }

  const totalSharesWithCalls = portfolioValue.sharesPositions.reduce(
    (sum, pos) => sum + (pos.coveredCallsAgainst || 0),
    0,
  )
  const totalAvailableShares = portfolioValue.sharesPositions.reduce((sum, pos) => sum + (pos.availableShares || 0), 0)

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Portfolio Value</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)} className="h-7 px-2">
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="h-7 px-2">
                <PieChart className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Portfolio Value */}
        <div className="text-center">
          <div className="text-3xl font-bold text-foreground mb-1">
            {formatCurrency(portfolioValue.totalPortfolioValue)}
          </div>
          <div
            className={`flex items-center justify-center gap-1 text-sm ${getChangeColor(portfolioValue.totalReturn)}`}
          >
            {getChangeIcon(portfolioValue.totalReturn)}
            <span>{formatCurrency(portfolioValue.totalReturn)}</span>
            <span>({formatPercent(portfolioValue.totalReturnPercent)})</span>
          </div>
          {portfolioValue.dayChange !== 0 && (
            <div className={`text-xs ${getChangeColor(portfolioValue.dayChange)} mt-1`}>
              Today: {formatCurrency(portfolioValue.dayChange)} ({formatPercent(portfolioValue.dayChangePercent)})
            </div>
          )}
        </div>

        {/* Portfolio Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Cash</span>
            <span className="font-medium">{formatCurrency(portfolioValue.totalCash)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Shares</span>
              {totalSharesWithCalls > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  {totalSharesWithCalls} covered
                </Badge>
              )}
            </div>
            <span className="font-medium">{formatCurrency(portfolioValue.sharesValue)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Options</span>
            <span className={`font-medium ${getChangeColor(portfolioValue.optionsValue)}`}>
              {formatCurrency(portfolioValue.optionsValue)}
            </span>
          </div>
          <div className="border-t border-border/50 pt-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span>Total Equity</span>
              <span>{formatCurrency(portfolioValue.totalEquity)}</span>
            </div>
          </div>
        </div>

        {/* Stock Positions Detail */}
        {portfolioValue.sharesPositions.length > 0 && (
          <Collapsible open={showStockDetails} onOpenChange={setShowStockDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-8 px-2 text-xs">
                <span>Stock Positions ({portfolioValue.sharesPositions.length})</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">
              {portfolioValue.sharesPositions.map((position, index) => (
                <div key={index} className="p-2 bg-muted/20 rounded text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{position.symbol}</span>
                      <span className="text-muted-foreground">{position.quantity} shares</span>
                      {(position.coveredCallsAgainst || 0) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          {position.coveredCallsAgainst} covered
                        </Badge>
                      )}
                    </div>
                    <span className="font-medium">{formatCurrency(position.marketValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Cost: {formatCurrency(position.costBasis)} | Current: {formatCurrency(position.currentPrice)}
                    </span>
                    <span className={getChangeColor(position.unrealizedPL)}>
                      {formatCurrency(position.unrealizedPL)} ({formatPercent(position.unrealizedPLPercent)})
                    </span>
                  </div>
                  {(position.availableShares || 0) < position.quantity && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Available: {position.availableShares} shares | Covered: {position.coveredCallsAgainst} shares
                    </div>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Detailed Breakdown */}
        {showDetails && (
          <div className="space-y-3 pt-3 border-t border-border/50">
            <div>
              <h4 className="text-sm font-medium mb-2">Risk Metrics</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PUT Collateral Tied Up:</span>
                  <span>{formatCurrency(portfolioValue.collateralValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shares in Covered Calls:</span>
                  <span>{totalSharesWithCalls.toLocaleString()} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available Shares:</span>
                  <span>{totalAvailableShares.toLocaleString()} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buying Power Used:</span>
                  <span>
                    {((portfolioValue.collateralValue / portfolioValue.totalPortfolioValue) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Portfolio Allocation Chart */}
            <div>
              <h4 className="text-sm font-medium mb-2">Allocation</h4>
              <div className="space-y-2">
                {portfolioValue.totalCash > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                    <span className="text-xs text-muted-foreground flex-1">Cash</span>
                    <span className="text-xs font-medium">
                      {((portfolioValue.totalCash / portfolioValue.totalPortfolioValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {portfolioValue.sharesValue > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                    <span className="text-xs text-muted-foreground flex-1">
                      Shares ({totalSharesWithCalls > 0 ? `${totalSharesWithCalls} covered` : "all available"})
                    </span>
                    <span className="text-xs font-medium">
                      {((portfolioValue.sharesValue / portfolioValue.totalPortfolioValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {Math.abs(portfolioValue.optionsValue) > 0 && (
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-sm ${portfolioValue.optionsValue >= 0 ? "bg-purple-500" : "bg-orange-500"}`}
                    ></div>
                    <span className="text-xs text-muted-foreground flex-1">Options</span>
                    <span className="text-xs font-medium">
                      {((Math.abs(portfolioValue.optionsValue) / portfolioValue.totalPortfolioValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
