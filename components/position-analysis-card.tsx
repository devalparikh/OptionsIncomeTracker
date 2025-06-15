"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getPositionAnalysis } from "@/app/actions/market-data"
import type { PositionAnalysis } from "@/utils/option-calculations"
import type { StockQuote } from "@/lib/alpha-vantage"
import { TrendingUp, TrendingDown, Target, Clock, DollarSign, AlertTriangle } from "lucide-react"

interface PositionAnalysisCardProps {
  positionId: string
  symbol: string
  onAnalysisUpdate?: (analysis: PositionAnalysis) => void
}

export function PositionAnalysisCard({ positionId, symbol, onAnalysisUpdate }: PositionAnalysisCardProps) {
  const [analysis, setAnalysis] = useState<PositionAnalysis | null>(null)
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getPositionAnalysis(positionId)
      if (result.success) {
        setAnalysis(result.analysis)
        setQuote(result.quote)
        onAnalysisUpdate?.(result.analysis)
      } else {
        setError(result.error || "Failed to fetch analysis")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [positionId])

  if (loading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchAnalysis} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analysis || !quote) {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-blue-500"
      case "ASSIGNED":
        return "bg-orange-500"
      case "EXPIRED":
        return "bg-gray-500"
      case "CLOSED":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{symbol} Analysis</CardTitle>
          <Badge className={getStatusColor(analysis.status)}>{analysis.status}</Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            {formatCurrency(quote.price)}
          </div>
          <div className={`flex items-center gap-1 ${quote.change >= 0 ? "text-green-600" : "text-red-600"}`}>
            {quote.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {formatCurrency(quote.change)} ({formatPercent(quote.changePercent)})
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {analysis.daysToExpiry}d to expiry
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Legs Analysis */}
        <div>
          <h4 className="text-sm font-medium mb-2">Option Legs</h4>
          <div className="space-y-2">
            {analysis.legs.map((leg) => (
              <div key={leg.id} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                <div className="flex items-center gap-2">
                  <Badge variant={leg.type === "PUT" ? "destructive" : "default"} className="text-xs">
                    {leg.side} {leg.type}
                  </Badge>
                  <span className="text-sm font-medium">${leg.strike}</span>
                  <span className="text-xs text-muted-foreground">{leg.daysToExpiry}d</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatCurrency(leg.distanceFromStrike)} away</div>
                  <div className="text-xs text-muted-foreground">
                    {leg.probabilityOfExercise.toFixed(1)}% exercise prob.
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Risk Metrics</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Break Even:</span>
                <span>{formatCurrency(analysis.riskMetrics.breakEvenPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital at Risk:</span>
                <span>{formatCurrency(analysis.riskMetrics.capitalAtRisk)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Gain:</span>
                <span className="text-green-600">{formatCurrency(analysis.riskMetrics.maxGain)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">P&L Analysis</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Realized:</span>
                <span className={analysis.profitLoss.realizedPL >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(analysis.profitLoss.realizedPL)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unrealized:</span>
                <span className={analysis.profitLoss.unrealizedPL >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(analysis.profitLoss.unrealizedPL)}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total P&L:</span>
                <span className={analysis.profitLoss.totalPL >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(analysis.profitLoss.totalPL)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Exercise Risk Indicator */}
        {analysis.legs.some((leg) => leg.probabilityOfExercise > 50) && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Exercise Risk</span>
            </div>
            {analysis.legs
              .filter((leg) => leg.probabilityOfExercise > 50)
              .map((leg) => (
                <div key={leg.id} className="text-xs text-orange-700 mb-1">
                  {leg.side} {leg.type} ${leg.strike}: {leg.probabilityOfExercise.toFixed(1)}% probability
                  <Progress value={leg.probabilityOfExercise} className="h-1 mt-1 bg-orange-100" />
                </div>
              ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={fetchAnalysis} className="w-full">
          Refresh Analysis
        </Button>
      </CardContent>
    </Card>
  )
}
