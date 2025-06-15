import type { LegWithPosition } from "@/lib/supabase/queries"

export interface PositionAnalysis {
  id: string
  symbol: string
  currentPrice: number
  legs: LegAnalysis[]
  totalPremiumCollected: number
  totalCommissions: number
  netPremium: number
  status: "ACTIVE" | "ASSIGNED" | "EXPIRED" | "CLOSED"
  daysToExpiry: number
  riskMetrics: RiskMetrics
  profitLoss: ProfitLossAnalysis
}

export interface LegAnalysis {
  id: string
  type: "PUT" | "CALL"
  side: "SELL" | "BUY"
  strike: number
  currentPrice: number
  expiry: Date
  daysToExpiry: number
  isExpired: boolean
  isInTheMoney: boolean
  intrinsicValue: number
  timeValue: number
  distanceFromStrike: number
  distancePercent: number
  probabilityOfExercise: number
  shouldBeExercised: boolean
  premiumCollected: number
  currentValue: number
  unrealizedPL: number
  status: "ACTIVE" | "ASSIGNED" | "EXPIRED" | "CLOSED"
}

export interface RiskMetrics {
  maxLoss: number
  maxGain: number
  breakEvenPrice: number
  capitalAtRisk: number
  returnOnCapital: number
  annualizedReturn: number
}

export interface ProfitLossAnalysis {
  realizedPL: number
  unrealizedPL: number
  totalPL: number
  roi: number
  annualizedROI: number
}

export function analyzeLeg(leg: LegWithPosition, currentPrice: number, marketDate: Date = new Date()): LegAnalysis {
  const daysToExpiry = Math.max(0, Math.ceil((leg.expiry.getTime() - marketDate.getTime()) / (1000 * 60 * 60 * 24)))
  const isExpired = daysToExpiry === 0

  // Calculate intrinsic value
  let intrinsicValue = 0
  let isInTheMoney = false

  if (leg.type === "PUT") {
    intrinsicValue = Math.max(0, leg.strike - currentPrice)
    isInTheMoney = currentPrice < leg.strike
  } else {
    // CALL
    intrinsicValue = Math.max(0, currentPrice - leg.strike)
    isInTheMoney = currentPrice > leg.strike
  }

  // Estimate time value (simplified - in reality would use Black-Scholes)
  const timeValue = Math.max(0, leg.open_price - intrinsicValue)

  // Distance calculations
  const distanceFromStrike = Math.abs(currentPrice - leg.strike)
  const distancePercent = (distanceFromStrike / leg.strike) * 100

  // Probability of exercise (simplified heuristic)
  let probabilityOfExercise = 0
  if (isExpired) {
    probabilityOfExercise = isInTheMoney ? 100 : 0
  } else {
    // Simple model: based on how far ITM and time remaining
    if (isInTheMoney) {
      const moneyness = intrinsicValue / leg.strike
      const timeDecay = Math.max(0.1, daysToExpiry / 30) // Normalize to ~30 days
      probabilityOfExercise = Math.min(95, moneyness * 100 + 50 * (1 - timeDecay))
    } else {
      probabilityOfExercise = Math.max(5, 50 * Math.exp(-distancePercent / 10))
    }
  }

  // Should be exercised logic
  const shouldBeExercised = isExpired && isInTheMoney && intrinsicValue > 0.01

  // Premium and P&L calculations
  const premiumCollected = leg.open_price * 100 * leg.contracts
  const currentValue = intrinsicValue * 100 * leg.contracts
  const unrealizedPL = leg.side === "SELL" ? premiumCollected - currentValue : currentValue - premiumCollected

  // Status determination
  let status: LegAnalysis["status"] = "ACTIVE"
  if (leg.close_date) {
    status = "CLOSED"
  } else if (isExpired) {
    status = shouldBeExercised ? "ASSIGNED" : "EXPIRED"
  }

  return {
    id: leg.id,
    type: leg.type,
    side: leg.side,
    strike: leg.strike,
    currentPrice,
    expiry: leg.expiry,
    daysToExpiry,
    isExpired,
    isInTheMoney,
    intrinsicValue,
    timeValue,
    distanceFromStrike,
    distancePercent,
    probabilityOfExercise,
    shouldBeExercised,
    premiumCollected,
    currentValue,
    unrealizedPL,
    status,
  }
}

export function analyzePosition(
  legs: LegWithPosition[],
  currentPrice: number,
  marketDate: Date = new Date(),
): PositionAnalysis {
  if (legs.length === 0) {
    throw new Error("No legs provided for position analysis")
  }

  const symbol = legs[0].symbol
  const legAnalyses = legs.map((leg) => analyzeLeg(leg, currentPrice, marketDate))

  // Aggregate metrics
  const totalPremiumCollected = legAnalyses.reduce(
    (sum, leg) => sum + (leg.side === "SELL" ? leg.premiumCollected : 0),
    0,
  )

  const totalCommissions = legs.reduce((sum, leg) => sum + leg.commissions, 0)
  const netPremium = totalPremiumCollected - totalCommissions

  // Determine overall position status
  const hasActiveLeg = legAnalyses.some((leg) => leg.status === "ACTIVE")
  const hasAssignedLeg = legAnalyses.some((leg) => leg.status === "ASSIGNED")
  const allExpired = legAnalyses.every((leg) => leg.status === "EXPIRED" || leg.status === "CLOSED")

  let status: PositionAnalysis["status"] = "ACTIVE"
  if (hasAssignedLeg) {
    status = "ASSIGNED"
  } else if (allExpired) {
    status = "EXPIRED"
  } else if (legAnalyses.every((leg) => leg.status === "CLOSED")) {
    status = "CLOSED"
  }

  // Days to expiry (minimum across all active legs)
  const activeLegDays = legAnalyses.filter((leg) => leg.status === "ACTIVE").map((leg) => leg.daysToExpiry)
  const daysToExpiry = activeLegDays.length > 0 ? Math.min(...activeLegDays) : 0

  // Risk metrics calculation
  const putLegs = legAnalyses.filter((leg) => leg.type === "PUT" && leg.side === "SELL")
  const maxLoss =
    putLegs.reduce((sum, leg) => sum + leg.strike * 100 * legs.find((l) => l.id === leg.id)!.contracts, 0) -
    totalPremiumCollected

  const maxGain = totalPremiumCollected
  const capitalAtRisk = putLegs.reduce(
    (sum, leg) => sum + leg.strike * 100 * legs.find((l) => l.id === leg.id)!.contracts,
    0,
  )

  const breakEvenPrice =
    putLegs.length > 0
      ? putLegs[0].strike - totalPremiumCollected / (100 * legs.find((l) => l.type === "PUT")?.contracts || 1)
      : 0

  const returnOnCapital = capitalAtRisk > 0 ? (netPremium / capitalAtRisk) * 100 : 0
  const annualizedReturn = daysToExpiry > 0 ? returnOnCapital * (365 / daysToExpiry) : 0

  // P&L Analysis
  const unrealizedPL = legAnalyses.reduce((sum, leg) => sum + leg.unrealizedPL, 0)
  const realizedPL = legs
    .filter((leg) => leg.close_date)
    .reduce((sum, leg) => {
      const premium = leg.open_price * 100 * leg.contracts
      const closeCost = (leg.close_price || 0) * 100 * leg.contracts
      return sum + (leg.side === "SELL" ? premium - closeCost : closeCost - premium)
    }, 0)

  const totalPL = realizedPL + unrealizedPL
  const roi = capitalAtRisk > 0 ? (totalPL / capitalAtRisk) * 100 : 0
  const annualizedROI = daysToExpiry > 0 ? roi * (365 / daysToExpiry) : 0

  return {
    id: legs[0].position_id,
    symbol,
    currentPrice,
    legs: legAnalyses,
    totalPremiumCollected,
    totalCommissions,
    netPremium,
    status,
    daysToExpiry,
    riskMetrics: {
      maxLoss,
      maxGain,
      breakEvenPrice,
      capitalAtRisk,
      returnOnCapital,
      annualizedReturn,
    },
    profitLoss: {
      realizedPL,
      unrealizedPL,
      totalPL,
      roi,
      annualizedROI,
    },
  }
}

export function shouldAutoExercise(legAnalysis: LegAnalysis): boolean {
  return legAnalysis.shouldBeExercised && legAnalysis.isExpired && legAnalysis.intrinsicValue > 0.01
}

export function calculateAssignmentDetails(leg: LegWithPosition, currentPrice: number) {
  if (leg.type !== "PUT" || leg.side !== "SELL") {
    return null
  }

  const sharesAssigned = leg.contracts * 100
  const costBasis = leg.strike
  const totalCost = sharesAssigned * costBasis
  const premiumReceived = leg.open_price * 100 * leg.contracts
  const netCostBasis = costBasis - premiumReceived / sharesAssigned
  const currentValue = sharesAssigned * currentPrice
  const unrealizedPL = currentValue - totalCost + premiumReceived

  return {
    sharesAssigned,
    costBasis,
    netCostBasis,
    totalCost,
    premiumReceived,
    currentValue,
    unrealizedPL,
  }
}
