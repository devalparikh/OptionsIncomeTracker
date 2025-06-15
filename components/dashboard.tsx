"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ContractEntryForm } from "./contract-entry-form"
import { MarketDataUpdater } from "./market-data-updater"
import { PositionAnalysisCard } from "./position-analysis-card"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useLegsData } from "@/hooks/use-legs-data"
import { calculatePremiumIncome, calculateCapitalAtRisk, calculateLegROI } from "@/utils/calculations"
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Loader2, AlertCircle, Activity } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
// Add imports at the top
import { PortfolioValueWidget } from "./portfolio-value-widget"
import { SharesAtRiskWidget } from "./shares-at-risk-widget"
import { RobinhoodStyleChart } from "./robinhood-style-chart"
import { calculatePortfolioValue, generatePortfolioPerformance } from "@/utils/portfolio-calculations"

interface DashboardProps {
  onNewEntryRequest?: () => void
}

export function Dashboard({ onNewEntryRequest }: DashboardProps) {
  const [activeTab, setActiveTab] = useState("open")
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)
  const { legs, loading, error, refetch } = useLegsData()

  // Add state for portfolio calculations
  const [portfolioValue, setPortfolioValue] = useState<any>(null)
  const [stockQuotes, setStockQuotes] = useState<Map<string, any>>(new Map())

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "n",
      ctrlKey: true,
      callback: () => {
        setActiveTab("add")
        onNewEntryRequest?.()
      },
      description: "Create new contract entry",
    },
    {
      key: "d",
      ctrlKey: true,
      callback: () => setActiveTab("open"),
      description: "Go to dashboard",
    },
    {
      key: "m",
      ctrlKey: true,
      callback: () => setActiveTab("market"),
      description: "Go to market analysis",
    },
  ])

  const handleContractAdded = () => {
    setActiveTab("open")
    refetch()
  }

  // Helper function to check if a contract is expired
  const isExpired = (expiry: Date): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return expiry < today
  }

  // Separate legs into open, expired, and closed
  const openLegs = legs.filter((leg) => !leg.close_date && !isExpired(leg.expiry))
  const expiredLegs = legs.filter((leg) => !leg.close_date && isExpired(leg.expiry))
  const closedLegs = legs.filter((leg) => leg.close_date)

  // Combine expired and closed legs for the closed tab
  const allClosedLegs = [...closedLegs, ...expiredLegs]

  // Group legs by position for analysis
  const positionGroups = useMemo(() => {
    const groups = new Map<string, typeof legs>()
    legs.forEach((leg) => {
      const key = `${leg.symbol}-${leg.position_id}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(leg)
    })
    return groups
  }, [legs])

  const portfolioMetrics = useMemo(() => {
    const totalPremium = legs.reduce((sum, leg) => sum + calculatePremiumIncome(leg.open_price, leg.contracts, 0), 0)

    const totalCapitalAtRisk = openLegs
      .filter((leg) => leg.type === "PUT")
      .reduce((sum, leg) => sum + calculateCapitalAtRisk(leg.strike, leg.contracts), 0)

    const realizedPL = allClosedLegs.reduce((sum, leg) => {
      const premium = calculatePremiumIncome(leg.open_price, leg.contracts, 0)
      const closePL = leg.close_price
        ? (leg.side === "SELL" ? -1 : 1) * (leg.close_price - leg.open_price) * 100 * leg.contracts
        : 0
      return sum + premium + closePL
    }, 0)

    const unrealizedPL = openLegs.reduce((sum, leg) => {
      const premium = calculatePremiumIncome(leg.open_price, leg.contracts, 0)
      return sum + premium
    }, 0)

    // Calculate projected monthly income based on current open positions
    const projectedMonthlyIncome = openLegs.reduce((sum, leg) => {
      const daysToExpiry = Math.ceil((leg.expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      const premium = calculatePremiumIncome(leg.open_price, leg.contracts, 0)
      const monthlyRate = daysToExpiry > 0 ? (premium / daysToExpiry) * 30 : 0
      return sum + monthlyRate
    }, 0)

    return {
      totalPremium,
      totalCapitalAtRisk,
      realizedPL,
      unrealizedPL,
      netPL: realizedPL + unrealizedPL,
      projectedMonthlyIncome,
    }
  }, [legs, openLegs])

  // Add portfolio calculations in the useMemo section (after portfolioMetrics)
  const portfolioCalculations = useMemo(() => {
    // Mock stock positions for now - in real app, fetch from database
    const stockPositions: any[] = []

    const portfolioVal = calculatePortfolioValue(legs, stockPositions, stockQuotes, 10000)
    const performanceData = generatePortfolioPerformance(legs, stockPositions, 10000)

    return { portfolioVal, performanceData }
  }, [legs, stockQuotes])

  // Generate performance data based on actual legs
  const performanceData = useMemo(() => {
    if (legs.length === 0) {
      return [
        { date: "Start", value: 10000, premium: 0 },
        { date: "Current", value: 10000, premium: 0 },
      ]
    }

    // Sort legs by date and create cumulative data
    const sortedLegs = [...legs].sort((a, b) => a.openDate.getTime() - b.openDate.getTime())
    const data = [{ date: "Start", value: 10000, premium: 0 }]

    let cumulativePremium = 0
    let cumulativeValue = 10000

    sortedLegs.forEach((leg, index) => {
      const premium = calculatePremiumIncome(leg.open_price, leg.contracts, 0)
      cumulativePremium += premium
      cumulativeValue += premium

      if (index % Math.max(1, Math.floor(sortedLegs.length / 6)) === 0 || index === sortedLegs.length - 1) {
        data.push({
          date: leg.openDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          value: cumulativeValue,
          premium: cumulativePremium,
        })
      }
    })

    return data
  }, [legs])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-20 pb-8">
          <div className="container mx-auto px-6 flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading your portfolio data...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-20 pb-8">
          <div className="container mx-auto px-6">
            <Alert className="border-red-500">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-600">
                Error loading data: {error}
                <Button variant="outline" size="sm" onClick={refetch} className="ml-2">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content with top padding for fixed navbar */}
      <div className="pt-20 pb-8">
        <div className="container mx-auto px-6 space-y-8">
          {/* Market Data Updater */}
          <MarketDataUpdater />

          {/* Replace the existing Portfolio Performance Chart section with: */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RobinhoodStyleChart data={portfolioCalculations.performanceData} className="h-full" />
            </div>
            <div className="space-y-4">
              <PortfolioValueWidget
                portfolioValue={portfolioCalculations.portfolioVal}
                loading={loading}
                onRefresh={refetch}
              />
              <SharesAtRiskWidget sharesAtRisk={portfolioCalculations.portfolioVal.sharesAtRisk} />
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Premium</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">${portfolioMetrics.totalPremium.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Gross premium collected</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net P/L</CardTitle>
                {portfolioMetrics.netPL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${portfolioMetrics.netPL >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  ${portfolioMetrics.netPL.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Total profit/loss</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Projected Monthly</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  ${portfolioMetrics.projectedMonthlyIncome.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Based on open positions</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Capital at Risk</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  ${portfolioMetrics.totalCapitalAtRisk.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Open put positions</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open Positions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{openLegs.length}</div>
                <p className="text-xs text-muted-foreground">Active contracts</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted/50 backdrop-blur-sm border border-border/50">
              <TabsTrigger value="open" className="data-[state=active]:bg-background/80">
                Open Positions ({openLegs.length})
              </TabsTrigger>
              <TabsTrigger value="closed" className="data-[state=active]:bg-background/80">
                Closed/Expired ({allClosedLegs.length})
              </TabsTrigger>
              <TabsTrigger value="market" className="data-[state=active]:bg-background/80">
                <Activity className="h-4 w-4 mr-1" />
                Market Analysis
              </TabsTrigger>
              <TabsTrigger value="add" className="data-[state=active]:bg-background/80">
                Add Contract
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-foreground">Open Wheel Positions</CardTitle>
                  <p className="text-sm text-muted-foreground">Active contracts that have not yet expired</p>
                </CardHeader>
                <CardContent>
                  {openLegs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No open positions. Add a new contract to get started.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead className="text-muted-foreground">Symbol</TableHead>
                          <TableHead className="text-muted-foreground">Type</TableHead>
                          <TableHead className="text-muted-foreground">Strike</TableHead>
                          <TableHead className="text-muted-foreground">Expiry</TableHead>
                          <TableHead className="text-muted-foreground">Open Price</TableHead>
                          <TableHead className="text-muted-foreground">Contracts</TableHead>
                          <TableHead className="text-muted-foreground">DTE</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openLegs.map((leg) => {
                          const dte = Math.ceil((leg.expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

                          return (
                            <TableRow key={leg.id} className="border-border/50 hover:bg-muted/20">
                              <TableCell className="font-medium text-foreground">{leg.symbol}</TableCell>
                              <TableCell>
                                <Badge variant={leg.type === "PUT" ? "destructive" : "default"}>
                                  {leg.side} {leg.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-foreground">${leg.strike}</TableCell>
                              <TableCell className="text-foreground">{leg.expiry.toLocaleDateString()}</TableCell>
                              <TableCell className="text-blue-600 font-medium">${leg.open_price.toFixed(2)}</TableCell>
                              <TableCell className="text-foreground">{leg.contracts}</TableCell>
                              <TableCell>
                                <Badge variant={dte <= 7 ? "destructive" : dte <= 21 ? "secondary" : "outline"}>
                                  {dte}d
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">Active</Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedPositionId(leg.position_id)}
                                >
                                  Analyze
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="closed" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-foreground">Closed & Expired Positions</CardTitle>
                  <p className="text-sm text-muted-foreground">Manually closed contracts and expired positions</p>
                </CardHeader>
                <CardContent>
                  {allClosedLegs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No closed or expired positions yet.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead className="text-muted-foreground">Symbol</TableHead>
                          <TableHead className="text-muted-foreground">Type</TableHead>
                          <TableHead className="text-muted-foreground">Strike</TableHead>
                          <TableHead className="text-muted-foreground">Open Date</TableHead>
                          <TableHead className="text-muted-foreground">Close/Expiry Date</TableHead>
                          <TableHead className="text-muted-foreground">Net P/L</TableHead>
                          <TableHead className="text-muted-foreground">ROI</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allClosedLegs.map((leg) => {
                          const isExpiredContract = !leg.close_date && isExpired(leg.expiry)
                          const openPremium = calculatePremiumIncome(leg.open_price, leg.contracts, 0)
                          const closeCost = leg.close_price ? leg.close_price * 100 * leg.contracts : 0
                          const netPL = leg.side === "SELL" ? openPremium - closeCost : closeCost - openPremium
                          const collateral =
                            leg.type === "PUT"
                              ? calculateCapitalAtRisk(leg.strike, leg.contracts)
                              : leg.open_price * 100 * leg.contracts
                          const roi = calculateLegROI(netPL, collateral)

                          return (
                            <TableRow key={leg.id} className="border-border/50 hover:bg-muted/20">
                              <TableCell className="font-medium text-foreground">{leg.symbol}</TableCell>
                              <TableCell>
                                <Badge variant={leg.type === "PUT" ? "destructive" : "default"}>
                                  {leg.side} {leg.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-foreground">${leg.strike}</TableCell>
                              <TableCell className="text-foreground">{leg.openDate.toLocaleDateString()}</TableCell>
                              <TableCell className="text-foreground">
                                {leg.closeDate?.toLocaleDateString() || leg.expiry.toLocaleDateString()}
                              </TableCell>
                              <TableCell
                                className={netPL >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}
                              >
                                ${netPL.toFixed(2)}
                              </TableCell>
                              <TableCell
                                className={roi >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}
                              >
                                {roi.toFixed(2)}%
                              </TableCell>
                              <TableCell>
                                <Badge variant={isExpiredContract ? "secondary" : "outline"}>
                                  {isExpiredContract ? "Expired" : leg.is_assigned ? "Assigned" : "Closed"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="market" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Array.from(positionGroups.entries()).map(([key, positionLegs]) => {
                  const symbol = positionLegs[0].symbol
                  const positionId = positionLegs[0].position_id

                  return <PositionAnalysisCard key={key} positionId={positionId} symbol={symbol} />
                })}

                {positionGroups.size === 0 && (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    No positions to analyze. Add some contracts to see market analysis.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="add" className="space-y-4">
              <div className="flex justify-center">
                <ContractEntryForm onSubmit={handleContractAdded} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
