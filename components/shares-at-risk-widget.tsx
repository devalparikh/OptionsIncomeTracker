"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Target, Clock, TrendingDown, TrendingUp } from "lucide-react"
import type { SharesAtRiskSummary } from "@/utils/portfolio-calculations"

interface SharesAtRiskWidgetProps {
  sharesAtRisk: SharesAtRiskSummary
}

export function SharesAtRiskWidget({ sharesAtRisk }: SharesAtRiskWidgetProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const getAssignmentRiskLevel = (probability: number) => {
    if (probability >= 70) return { level: "HIGH", color: "bg-red-500", textColor: "text-red-600" }
    if (probability >= 40) return { level: "MEDIUM", color: "bg-orange-500", textColor: "text-orange-600" }
    return { level: "LOW", color: "bg-green-500", textColor: "text-green-600" }
  }

  // Separate PUT and CALL assignments
  const putAssignments = sharesAtRisk.positions.filter((pos) => pos.type === "PUT_ASSIGNMENT")
  const callAssignments = sharesAtRisk.positions.filter((pos) => pos.type === "CALL_ASSIGNMENT")

  const totalRiskValue = sharesAtRisk.positions.reduce((sum, pos) => sum + pos.riskValue, 0)
  const weightedProbability =
    sharesAtRisk.positions.length > 0
      ? sharesAtRisk.positions.reduce((sum, pos) => sum + pos.probability * pos.riskValue, 0) / totalRiskValue
      : 0

  const overallRisk = getAssignmentRiskLevel(weightedProbability)

  if (sharesAtRisk.totalShares === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Assignment Risk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No assignment risk</p>
            <p className="text-xs">All options are OTM or closed</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Assignment Risk
          </CardTitle>
          <Badge className={overallRisk.color}>{overallRisk.level} RISK</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{sharesAtRisk.totalShares.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">shares at risk</div>
          <div className="text-lg font-semibold text-foreground mt-1">{formatCurrency(sharesAtRisk.totalValue)}</div>
          <div className="text-xs text-muted-foreground">total value at risk</div>
        </div>

        {/* Overall Risk Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Assignment Probability</span>
            <span className={`font-medium ${overallRisk.textColor}`}>{weightedProbability.toFixed(1)}%</span>
          </div>
          <Progress value={weightedProbability} className="h-2" />
        </div>

        {/* Tabs for PUT vs CALL assignments */}
        <Tabs defaultValue="puts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="puts" className="text-xs">
              <TrendingDown className="h-3 w-3 mr-1" />
              PUT Risk ({putAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="calls" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              CALL Risk ({callAssignments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="puts" className="space-y-2 mt-3">
            <div className="text-xs text-muted-foreground mb-2">Shares you may be assigned:</div>
            {putAssignments.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">No PUT assignment risk</div>
            ) : (
              putAssignments.map((position, index) => {
                const risk = getAssignmentRiskLevel(position.probability)
                const isITM = position.currentPrice < position.strikePrice
                const distance = Math.abs(position.currentPrice - position.strikePrice)
                const distancePercent = (distance / position.strikePrice) * 100

                return (
                  <div key={index} className="p-2 bg-muted/20 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{position.symbol}</span>
                        <Badge variant={isITM ? "destructive" : "outline"} className="text-xs">
                          {isITM ? "ITM" : "OTM"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">+{position.shares} shares</div>
                        <div className="text-xs text-muted-foreground">@ ${position.strikePrice}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-muted-foreground">{position.daysToExpiry}d</span>
                      </div>
                      <div className="text-muted-foreground">
                        ${distance.toFixed(2)} ({distancePercent.toFixed(1)}%) away
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-muted-foreground">Assignment Risk</span>
                        <span className={risk.textColor}>{position.probability.toFixed(1)}%</span>
                      </div>
                      <Progress value={position.probability} className="h-1" />
                    </div>
                  </div>
                )
              })
            )}
          </TabsContent>

          <TabsContent value="calls" className="space-y-2 mt-3">
            <div className="text-xs text-muted-foreground mb-2">Shares that may be called away:</div>
            {callAssignments.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">No CALL assignment risk</div>
            ) : (
              callAssignments.map((position, index) => {
                const risk = getAssignmentRiskLevel(position.probability)
                const isITM = position.currentPrice > position.strikePrice
                const distance = Math.abs(position.currentPrice - position.strikePrice)
                const distancePercent = (distance / position.strikePrice) * 100

                return (
                  <div key={index} className="p-2 bg-muted/20 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{position.symbol}</span>
                        <Badge variant={isITM ? "destructive" : "outline"} className="text-xs">
                          {isITM ? "ITM" : "OTM"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">-{position.shares} shares</div>
                        <div className="text-xs text-muted-foreground">@ ${position.strikePrice}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-muted-foreground">{position.daysToExpiry}d</span>
                      </div>
                      <div className="text-muted-foreground">
                        ${distance.toFixed(2)} ({distancePercent.toFixed(1)}%) away
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-muted-foreground">Assignment Risk</span>
                        <span className={risk.textColor}>{position.probability.toFixed(1)}%</span>
                      </div>
                      <Progress value={position.probability} className="h-1" />
                    </div>
                  </div>
                )
              })
            )}
          </TabsContent>
        </Tabs>

        {/* Risk Warning */}
        {weightedProbability > 50 && (
          <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">High Assignment Risk</span>
            </div>
            <p className="text-xs text-orange-700 mt-1">
              Consider rolling or closing positions with high assignment probability.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
