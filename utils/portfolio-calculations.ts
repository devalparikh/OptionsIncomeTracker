import type { LegWithPosition } from "@/lib/supabase/queries"
import type { StockQuote } from "@/lib/alpha-vantage"

export interface SharesPosition {
  symbol: string
  quantity: number
  costBasis: number
  currentPrice: number
  marketValue: number
  unrealizedPL: number
  unrealizedPLPercent: number
  source: "ASSIGNMENT" | "PURCHASE" | "COLLATERAL"
  coveredCallsAgainst?: number // Number of shares with calls written against them
  availableShares?: number // Shares not tied up in covered calls
}

export interface PortfolioValue {
  totalCash: number
  totalEquity: number
  totalPortfolioValue: number
  sharesValue: number
  optionsValue: number
  collateralValue: number
  sharesAtRisk: SharesAtRiskSummary
  sharesPositions: SharesPosition[]
  dayChange: number
  dayChangePercent: number
  totalReturn: number
  totalReturnPercent: number
}

export interface SharesAtRiskSummary {
  totalShares: number
  totalValue: number
  positions: SharesAtRiskPosition[]
}

export interface SharesAtRiskPosition {
  symbol: string
  shares: number
  strikePrice: number
  currentPrice: number
  riskValue: number
  probability: number
  daysToExpiry: number
  type: "PUT_ASSIGNMENT" | "CALL_ASSIGNMENT"
}

export interface CoveredCallPosition {
  symbol: string
  sharesOwned: number
  callsWritten: number
  sharesCovered: number
  availableShares: number
  callStrike: number
  callExpiry: Date
  callPremium: number
  assignmentRisk: number
}

export interface PortfolioPerformancePoint {
  date: string
  portfolioValue: number
  totalReturn: number
  totalReturnPercent: number
  dayChange: number
  dayChangePercent: number
  sharesValue: number
  optionsValue: number
  cashValue: number
}

export interface CoveredCallSharePosition {
  symbol: string
  quantity: number
  costBasis: number
  currentPrice: number
  marketValue: number
  unrealizedPL: number
  unrealizedPLPercent: number
  coveredCallCount: number // Number of covered calls against these shares
  coveredCallStrikes: number[] // List of strike prices for the covered calls
  coveredCallExpiries: Date[] // List of expiry dates for the covered calls
  totalPremiumCollected: number // Total premium collected from covered calls
  potentialProfitIfAssigned: number // Potential profit if all calls are assigned
  averageDaysToExpiry: number // Average days to expiry across all covered calls
  averageAssignmentRisk: number // Average assignment risk across all covered calls
}

export function calculateSharesAtRisk(
  legs: LegWithPosition[],
  quotes: Map<string, StockQuote>,
  stockPositions: any[],
): SharesAtRiskSummary {
  const positions: SharesAtRiskPosition[] = []

  // Helper function to check if a position is expired
  const isExpired = (expiry: Date): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return expiry < today
  }

  // Find all open PUT positions that could be assigned (new shares)
  const openPuts = legs.filter(
    (leg) => leg.type === "PUT" && leg.side === "SELL" && !leg.closeDate && !leg.is_assigned && !isExpired(leg.expiry),
  )

  for (const leg of openPuts) {
    const quote = quotes.get(leg.symbol)
    if (!quote) continue

    const shares = leg.contracts * 100
    const strikePrice = leg.strike
    const currentPrice = quote.price
    const riskValue = shares * strikePrice

    // Calculate probability of assignment
    const daysToExpiry = Math.max(0, Math.ceil((leg.expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))

    const isITM = currentPrice < strikePrice
    const moneyness = isITM ? (strikePrice - currentPrice) / strikePrice : 0

    let probability = 0
    if (daysToExpiry === 0) {
      probability = isITM ? 95 : 5
    } else if (isITM) {
      probability = Math.min(90, moneyness * 100 + 30 * (1 - Math.min(1, daysToExpiry / 30)))
    } else {
      const otmPercent = ((currentPrice - strikePrice) / strikePrice) * 100
      probability = Math.max(5, 30 * Math.exp(-otmPercent / 10))
    }

    positions.push({
      symbol: leg.symbol,
      shares,
      strikePrice,
      currentPrice,
      riskValue,
      probability,
      daysToExpiry,
      type: "PUT_ASSIGNMENT",
    })
  }

  // Find all open CALL positions that could result in shares being called away
  const openCalls = legs.filter(
    (leg) => leg.type === "CALL" && leg.side === "SELL" && !leg.closeDate && !leg.is_assigned && !isExpired(leg.expiry),
  )

  for (const leg of openCalls) {
    const quote = quotes.get(leg.symbol)
    if (!quote) continue

    // Check if we actually own shares for this covered call
    const stockPosition = stockPositions.find((pos) => pos.symbol === leg.symbol)
    if (!stockPosition || stockPosition.quantity < leg.contracts * 100) continue

    const shares = leg.contracts * 100
    const strikePrice = leg.strike
    const currentPrice = quote.price
    const riskValue = shares * currentPrice // Value of shares that could be called away

    // Calculate probability of assignment for calls
    const daysToExpiry = Math.max(0, Math.ceil((leg.expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))

    const isITM = currentPrice > strikePrice
    const moneyness = isITM ? (currentPrice - strikePrice) / strikePrice : 0

    let probability = 0
    if (daysToExpiry === 0) {
      probability = isITM ? 95 : 5
    } else if (isITM) {
      probability = Math.min(90, moneyness * 100 + 40 * (1 - Math.min(1, daysToExpiry / 30)))
    } else {
      const otmPercent = ((strikePrice - currentPrice) / currentPrice) * 100
      probability = Math.max(5, 25 * Math.exp(-otmPercent / 8))
    }

    positions.push({
      symbol: leg.symbol,
      shares,
      strikePrice,
      currentPrice,
      riskValue,
      probability,
      daysToExpiry,
      type: "CALL_ASSIGNMENT",
    })
  }

  const totalShares = positions.reduce((sum, pos) => sum + pos.shares, 0)
  const totalValue = positions.reduce((sum, pos) => sum + pos.riskValue, 0)

  return {
    totalShares,
    totalValue,
    positions,
  }
}

export function analyzeCoveredCallPositions(
  legs: LegWithPosition[],
  stockPositions: any[],
  quotes: Map<string, StockQuote>,
): CoveredCallPosition[] {
  const coveredCalls: CoveredCallPosition[] = []

  // Group by symbol
  const symbolGroups = new Map<string, { stock: any; calls: LegWithPosition[] }>()

  // Add stock positions
  stockPositions.forEach((stock) => {
    if (!symbolGroups.has(stock.symbol)) {
      symbolGroups.set(stock.symbol, { stock, calls: [] })
    }
  })

  // Add call legs
  legs
    .filter((leg) => leg.type === "CALL" && leg.side === "SELL" && !leg.closeDate && !leg.is_assigned)
    .forEach((call) => {
      const group = symbolGroups.get(call.symbol)
      if (group) {
        group.calls.push(call)
      }
    })

  // Analyze each symbol
  symbolGroups.forEach((group, symbol) => {
    if (!group.stock || group.calls.length === 0) return

    const quote = quotes.get(symbol)
    if (!quote) return

    const totalCallContracts = group.calls.reduce((sum, call) => sum + call.contracts, 0)
    const sharesCovered = Math.min(group.stock.quantity, totalCallContracts * 100)
    const availableShares = Math.max(0, group.stock.quantity - sharesCovered)

    // For simplicity, use the first call's details (in reality, you'd handle multiple expirations)
    const primaryCall = group.calls[0]
    const daysToExpiry = Math.max(
      0,
      Math.ceil((primaryCall.expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    )

    const isITM = quote.price > primaryCall.strike
    const moneyness = isITM ? (quote.price - primaryCall.strike) / primaryCall.strike : 0

    let assignmentRisk = 0
    if (daysToExpiry === 0) {
      assignmentRisk = isITM ? 95 : 5
    } else if (isITM) {
      assignmentRisk = Math.min(90, moneyness * 100 + 40 * (1 - Math.min(1, daysToExpiry / 30)))
    } else {
      const otmPercent = ((primaryCall.strike - quote.price) / quote.price) * 100
      assignmentRisk = Math.max(5, 25 * Math.exp(-otmPercent / 8))
    }

    coveredCalls.push({
      symbol,
      sharesOwned: group.stock.quantity,
      callsWritten: totalCallContracts,
      sharesCovered,
      availableShares,
      callStrike: primaryCall.strike,
      callExpiry: primaryCall.expiry,
      callPremium: group.calls.reduce((sum, call) => sum + call.open_price * call.contracts, 0),
      assignmentRisk,
    })
  })

  return coveredCalls
}

export function analyzeCoveredCallSharePositions(
  legs: LegWithPosition[],
  stockPositions: any[],
  quotes: Map<string, StockQuote>,
): CoveredCallSharePosition[] {
  const sharePositions: CoveredCallSharePosition[] = []

  // Group legs by symbol
  const symbolGroups = new Map<string, { stock?: any; calls: LegWithPosition[] }>()

  // Add stock positions
  stockPositions.forEach((stock) => {
    symbolGroups.set(stock.symbol, { stock, calls: [] })
  })

  // Add call legs
  legs
    .filter((leg) => leg.type === "CALL" && leg.side === "SELL" && !leg.closeDate && !leg.is_assigned)
    .forEach((call) => {
      const group = symbolGroups.get(call.symbol)
      if (group) {
        group.calls.push(call)
      }
    })

  // Process each symbol group
  symbolGroups.forEach((group, symbol) => {
    if (!group.stock) return // Only skip if no stock position

    const quote = quotes.get(symbol)
    if (!quote) return

    const stock = group.stock
    const calls = group.calls

    // Calculate covered call metrics
    const coveredCallCount = calls.reduce((sum, call) => sum + call.contracts, 0)
    const coveredCallStrikes = calls.map(call => call.strike)
    const coveredCallExpiries = calls.map(call => call.expiry)
    const totalPremiumCollected = calls.reduce((sum, call) => sum + call.open_price * call.contracts * 100, 0)

    // Calculate average days to expiry and assignment risk
    const now = new Date()
    const daysToExpiry = coveredCallExpiries.map(expiry => 
      Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    )
    const averageDaysToExpiry = daysToExpiry.length > 0 
      ? daysToExpiry.reduce((sum, days) => sum + days, 0) / daysToExpiry.length 
      : 0

    // Calculate assignment risk for each call
    const assignmentRisks = calls.map(call => {
      const daysToExpiry = Math.max(0, Math.ceil((call.expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      const isITM = quote.price > call.strike
      const moneyness = isITM ? (quote.price - call.strike) / call.strike : 0

      if (daysToExpiry === 0) return isITM ? 95 : 5
      if (isITM) return Math.min(90, moneyness * 100 + 40 * (1 - Math.min(1, daysToExpiry / 30)))
      const otmPercent = ((call.strike - quote.price) / quote.price) * 100
      return Math.max(5, 25 * Math.exp(-otmPercent / 8))
    })
    const averageAssignmentRisk = assignmentRisks.length > 0
      ? assignmentRisks.reduce((sum, risk) => sum + risk, 0) / assignmentRisks.length
      : 0

    // Calculate potential profit if assigned
    const potentialProfitIfAssigned = calls.reduce((sum, call) => {
      const sharesCovered = call.contracts * 100
      const profitFromAssignment = (call.strike - stock.cost_basis) * sharesCovered
      const premiumCollected = call.open_price * sharesCovered
      return sum + profitFromAssignment + premiumCollected
    }, 0)

    // Calculate market value and P&L
    const marketValue = stock.quantity * quote.price
    const totalCost = stock.quantity * stock.cost_basis
    const unrealizedPL = marketValue - totalCost
    const unrealizedPLPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0

    sharePositions.push({
      symbol,
      quantity: stock.quantity,
      costBasis: stock.cost_basis,
      currentPrice: quote.price,
      marketValue,
      unrealizedPL,
      unrealizedPLPercent,
      coveredCallCount,
      coveredCallStrikes,
      coveredCallExpiries,
      totalPremiumCollected,
      potentialProfitIfAssigned,
      averageDaysToExpiry,
      averageAssignmentRisk,
    })
  })

  return sharePositions
}

export function calculatePortfolioValue(
  legs: LegWithPosition[],
  stockPositions: any[],
  quotes: Map<string, StockQuote>,
  cashBalance = 0,
): PortfolioValue {
  // Calculate shares positions with covered call analysis
  const sharesPositions: SharesPosition[] = []
  let totalSharesValue = 0

  // Analyze covered calls first
  const coveredCallPositions = analyzeCoveredCallPositions(legs, stockPositions, quotes)
  const coveredCallMap = new Map(coveredCallPositions.map((cc) => [cc.symbol, cc]))

  // Calculate CSP collateral value first
  const collateralValue = legs
    .filter((leg) => {
      const now = new Date()
      const isExpired = leg.expiry < now
      return leg.type === "PUT" && 
             leg.side === "SELL" && 
             !leg.closeDate && 
             !leg.is_assigned && 
             !isExpired
    })
    .reduce((sum, leg) => sum + leg.strike * 100 * leg.contracts, 0)

  // Adjust cash balance to account for CSP collateral
  const adjustedCashBalance = cashBalance - collateralValue

  for (const position of stockPositions) {
    const quote = quotes.get(position.symbol)
    if (!quote) continue

    const marketValue = position.quantity * quote.price
    const totalCost = position.quantity * position.cost_basis
    const unrealizedPL = marketValue - totalCost
    const unrealizedPLPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0

    const coveredCall = coveredCallMap.get(position.symbol)

    const sharesPosition: SharesPosition = {
      symbol: position.symbol,
      quantity: position.quantity,
      costBasis: position.cost_basis,
      currentPrice: quote.price,
      marketValue,
      unrealizedPL,
      unrealizedPLPercent,
      source: position.source || "PURCHASE",
      coveredCallsAgainst: coveredCall?.sharesCovered || 0,
      availableShares: coveredCall?.availableShares || position.quantity,
    }

    sharesPositions.push(sharesPosition)
    totalSharesValue += marketValue
  }

  // Calculate options value
  let optionsValue = 0
  const openLegs = legs.filter((leg) => !leg.closeDate && !leg.is_assigned)

  for (const leg of openLegs) {
    const quote = quotes.get(leg.symbol)
    if (!quote) continue

    // Estimate current option value (simplified)
    const intrinsicValue =
      leg.type === "PUT" ? Math.max(0, leg.strike - quote.price) : Math.max(0, quote.price - leg.strike)

    const timeValue = Math.max(0, leg.open_price - intrinsicValue)
    const daysToExpiry = Math.max(0, Math.ceil((leg.expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))

    // Simple time decay model
    const timeDecayFactor = daysToExpiry > 0 ? Math.max(0.1, daysToExpiry / 30) : 0
    const currentOptionValue = intrinsicValue + timeValue * timeDecayFactor

    const positionValue = currentOptionValue * 100 * leg.contracts
    optionsValue += leg.side === "SELL" ? -positionValue : positionValue
  }

  // Calculate shares at risk (including both PUT assignments and CALL assignments)
  const sharesAtRisk = calculateSharesAtRisk(legs, quotes, stockPositions)

  // Calculate total equity including allocated funds
  const totalEquity = totalSharesValue + optionsValue + collateralValue
  const totalPortfolioValue = adjustedCashBalance + totalEquity

  // Calculate returns (simplified - would need historical data for accurate calculation)
  const totalPremiumCollected = legs.reduce(
    (sum, leg) => sum + (leg.side === "SELL" ? leg.open_price * 100 * leg.contracts : 0),
    0,
  )

  const totalStockCost = sharesPositions.reduce((sum, pos) => sum + pos.quantity * pos.costBasis, 0)
  const initialInvestment = Math.max(10000, totalStockCost + collateralValue) // Include collateral in initial investment

  const totalReturn = totalEquity - initialInvestment + totalPremiumCollected
  const totalReturnPercent = initialInvestment > 0 ? (totalReturn / initialInvestment) * 100 : 0

  return {
    totalCash: adjustedCashBalance,
    totalEquity,
    totalPortfolioValue,
    sharesValue: totalSharesValue,
    optionsValue,
    collateralValue,
    sharesAtRisk,
    sharesPositions,
    dayChange: 0, // Would need previous day data
    dayChangePercent: 0,
    totalReturn,
    totalReturnPercent,
  }
}

export function generatePortfolioPerformance(
  legs: LegWithPosition[],
  stockPositions: any[] = [],
  startingValue = 10000,
): PortfolioPerformancePoint[] {
  // Ensure stockPositions is always an array
  const safeStockPositions = Array.isArray(stockPositions) ? stockPositions : []

  if (legs.length === 0 && safeStockPositions.length === 0) {
    return [
      {
        date: "Start",
        portfolioValue: startingValue,
        totalReturn: 0,
        totalReturnPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
        sharesValue: 0,
        optionsValue: 0,
        cashValue: startingValue,
      },
    ]
  }

  // Combine and sort all transactions by date
  const allTransactions: Array<{
    date: Date
    type: "OPTION" | "STOCK" | "COLLATERAL"
    value: number
    leg?: LegWithPosition
    stock?: any
  }> = []

  // Add option transactions
  legs.forEach((leg) => {
    const premium = leg.side === "SELL" ? leg.open_price * 100 * leg.contracts : -leg.open_price * 100 * leg.contracts
    allTransactions.push({
      date: leg.openDate,
      type: "OPTION",
      value: premium,
      leg,
    })

    // Add collateral transaction for CSPs
    if (leg.type === "PUT" && leg.side === "SELL" && !leg.closeDate && !leg.is_assigned) {
      allTransactions.push({
        date: leg.openDate,
        type: "COLLATERAL",
        value: -leg.strike * 100 * leg.contracts, // Negative because it's cash being set aside
        leg,
      })
    }
  })

  // Add stock transactions (simplified - assuming all bought at once)
  safeStockPositions.forEach((stock) => {
    allTransactions.push({
      date: new Date(stock.created_at || Date.now()),
      type: "STOCK",
      value: -stock.quantity * stock.cost_basis, // Negative because it's a purchase
      stock,
    })
  })

  allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime())

  const points: PortfolioPerformancePoint[] = []
  let cumulativeValue = startingValue
  let cumulativeStockValue = 0
  let cumulativeOptionsValue = 0
  let cumulativeCollateralValue = 0
  let previousValue = startingValue

  // Add starting point
  points.push({
    date: "Start",
    portfolioValue: startingValue,
    totalReturn: 0,
    totalReturnPercent: 0,
    dayChange: 0,
    dayChangePercent: 0,
    sharesValue: 0,
    optionsValue: 0,
    cashValue: startingValue,
  })

  // Process transactions in chronological order
  allTransactions.forEach((transaction, index) => {
    switch (transaction.type) {
      case "OPTION":
        cumulativeOptionsValue += transaction.value
        break
      case "STOCK":
        cumulativeStockValue += Math.abs(transaction.value) // Stock value (positive)
        cumulativeValue += transaction.value // Cash impact (negative for purchases)
        break
      case "COLLATERAL":
        cumulativeCollateralValue += Math.abs(transaction.value) // Collateral value (positive)
        cumulativeValue += transaction.value // Cash impact (negative for collateral)
        break
    }

    cumulativeValue =
      startingValue +
      cumulativeOptionsValue +
      cumulativeCollateralValue +
      (cumulativeStockValue - Math.abs(safeStockPositions.reduce((sum, s) => sum + s.quantity * s.cost_basis, 0)))

    // Add point every few transactions or at the end
    if (index % Math.max(1, Math.floor(allTransactions.length / 15)) === 0 || index === allTransactions.length - 1) {
      const totalReturn = cumulativeValue - startingValue
      const totalReturnPercent = (totalReturn / startingValue) * 100
      const dayChange = cumulativeValue - previousValue
      const dayChangePercent = previousValue > 0 ? (dayChange / previousValue) * 100 : 0

      points.push({
        date: transaction.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        portfolioValue: cumulativeValue,
        totalReturn,
        totalReturnPercent,
        dayChange,
        dayChangePercent,
        sharesValue: cumulativeStockValue,
        optionsValue: cumulativeOptionsValue,
        cashValue: startingValue - Math.abs(safeStockPositions.reduce((sum, s) => sum + s.quantity * s.cost_basis, 0)) - cumulativeCollateralValue,
      })

      previousValue = cumulativeValue
    }
  })

  return points
}
