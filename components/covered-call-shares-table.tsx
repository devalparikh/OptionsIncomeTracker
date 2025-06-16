"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import type { CoveredCallSharePosition } from "@/utils/portfolio-calculations"

interface CoveredCallSharesTableProps {
  positions: CoveredCallSharePosition[]
  loading?: boolean
  onRefresh?: () => void
}

export function CoveredCallSharesTable({ positions, loading, onRefresh }: CoveredCallSharesTableProps) {
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set())

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
  }

  const getPLColor = (value: number) => {
    if (value > 0) return "text-green-600"
    if (value < 0) return "text-red-600"
    return "text-muted-foreground"
  }

  const getAssignmentRiskBadge = (risk: number) => {
    if (risk >= 70) return { label: "High", variant: "destructive" as const }
    if (risk >= 40) return { label: "Medium", variant: "secondary" as const }
    return { label: "Low", variant: "default" as const }
  }

  const toggleSymbol = (symbol: string) => {
    const newExpanded = new Set(expandedSymbols)
    if (newExpanded.has(symbol)) {
      newExpanded.delete(symbol)
    } else {
      newExpanded.add(symbol)
    }
    setExpandedSymbols(newExpanded)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Covered Call Share Positions</CardTitle>
        {onRefresh && (
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none md:hidden" />
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none md:hidden" />
          <div className="overflow-x-auto scrollbar-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] whitespace-nowrap">Symbol</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Shares</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Cost Basis</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Current Price</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Market Value</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Unrealized P/L</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Calls</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Premium</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Potential Profit</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => (
                  <>
                    <TableRow key={position.symbol} className="cursor-pointer" onClick={() => toggleSymbol(position.symbol)}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {expandedSymbols.has(position.symbol) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          {position.symbol}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{position.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(position.costBasis)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(position.currentPrice)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(position.marketValue)}</TableCell>
                      <TableCell className={`text-right whitespace-nowrap ${getPLColor(position.unrealizedPL)}`}>
                        {formatCurrency(position.unrealizedPL)} ({formatPercent(position.unrealizedPLPercent)})
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{position.coveredCallCount}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(position.totalPremiumCollected)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(position.potentialProfitIfAssigned)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Badge variant={getAssignmentRiskBadge(position.averageAssignmentRisk).variant}>
                          {getAssignmentRiskBadge(position.averageAssignmentRisk).label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {expandedSymbols.has(position.symbol) && (
                      <TableRow>
                        <TableCell colSpan={10} className="bg-muted/20">
                          <div className="p-4 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Covered Call Details:</p>
                                <ul className="list-disc list-inside space-y-1 mt-1">
                                  {position.coveredCallStrikes.map((strike, index) => (
                                    <li key={index}>
                                      Strike: {formatCurrency(strike)} | Expiry:{" "}
                                      {position.coveredCallExpiries[index].toLocaleDateString()}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Metrics:</p>
                                <ul className="list-disc list-inside space-y-1 mt-1">
                                  <li>Average Days to Expiry: {Math.round(position.averageDaysToExpiry)} days</li>
                                  <li>Average Assignment Risk: {position.averageAssignmentRisk.toFixed(1)}%</li>
                                  <li>Total Premium Collected: {formatCurrency(position.totalPremiumCollected)}</li>
                                  <li>Potential Profit if Assigned: {formatCurrency(position.potentialProfitIfAssigned)}</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 