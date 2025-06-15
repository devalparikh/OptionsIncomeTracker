"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import type { PortfolioPerformancePoint } from "@/utils/portfolio-calculations"

interface RobinhoodStyleChartProps {
  data: PortfolioPerformancePoint[]
  className?: string
}

type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL"

export function RobinhoodStyleChart({ data, className }: RobinhoodStyleChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("ALL")
  const [hoveredPoint, setHoveredPoint] = useState<PortfolioPerformancePoint | null>(null)

  const timeRanges: TimeRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"]

  // Filter data based on selected time range
  const getFilteredData = () => {
    if (selectedRange === "ALL" || data.length <= 1) return data

    const now = new Date()
    const cutoffDate = new Date()

    switch (selectedRange) {
      case "1D":
        cutoffDate.setDate(now.getDate() - 1)
        break
      case "1W":
        cutoffDate.setDate(now.getDate() - 7)
        break
      case "1M":
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case "3M":
        cutoffDate.setMonth(now.getMonth() - 3)
        break
      case "1Y":
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        return data
    }

    // For now, return all data since we don't have exact dates
    // In a real implementation, you'd filter based on the actual dates
    return data
  }

  const filteredData = getFilteredData()
  const currentPoint = hoveredPoint || filteredData[filteredData.length - 1]
  const startingValue = filteredData[0]?.portfolioValue || 0
  const isPositive = currentPoint?.totalReturn >= 0

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as PortfolioPerformancePoint
      setHoveredPoint(point)
    }
    return null
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
  }

  return (
    <Card className={`border-border/50 bg-card/50 backdrop-blur-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Portfolio Performance</CardTitle>
          <div className="flex items-center gap-1">
            {timeRanges.map((range) => (
              <Button
                key={range}
                variant={selectedRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedRange(range)}
                className="h-7 px-2 text-xs"
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Value Display */}
        <div className="space-y-1">
          <div className="text-3xl font-bold text-foreground">{formatCurrency(currentPoint?.portfolioValue || 0)}</div>
          <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-green-600" : "text-red-600"}`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>{formatCurrency(currentPoint?.totalReturn || 0)}</span>
            <span>({formatPercent(currentPoint?.totalReturnPercent || 0)})</span>
            <Badge variant={isPositive ? "default" : "destructive"} className="ml-2">
              {isPositive ? "Profit" : "Loss"}
            </Badge>
          </div>
          {hoveredPoint && <div className="text-xs text-muted-foreground">{hoveredPoint.date}</div>}
        </div>

        {/* Chart */}
        <div className="h-64" onMouseLeave={handleMouseLeave}>
          <ChartContainer
            config={{
              portfolioValue: {
                label: "Portfolio Value",
                color: isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)",
              },
            }}
            className="h-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={false} />
                <YAxis hide />
                <ChartTooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={startingValue}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="2 2"
                  strokeOpacity={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="portfolioValue"
                  stroke={isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)",
                    strokeWidth: 2,
                    stroke: "white",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Portfolio Breakdown */}
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border/50">
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">{formatCurrency(currentPoint?.cashValue || 0)}</div>
            <div className="text-xs text-muted-foreground">Cash</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">{formatCurrency(currentPoint?.sharesValue || 0)}</div>
            <div className="text-xs text-muted-foreground">Shares</div>
          </div>
          <div className="text-center">
            <div
              className={`text-sm font-medium ${(currentPoint?.optionsValue || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(currentPoint?.optionsValue || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Options</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
