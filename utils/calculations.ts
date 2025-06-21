import type { Leg, WheelCycle } from "@/types"

export function calculateContractNotional(strike: number, contracts: number): number {
  return strike * 100 * contracts
}

export function calculatePremiumIncome(openPrice: number, contracts: number, commissions = 0): number {
  return openPrice * 100 * contracts
}

export function calculateCapitalAtRisk(strike: number, contracts: number): number {
  return strike * 100 * contracts
}

export function calculateLegROI(netPL: number, collateral: number): number {
  return collateral > 0 ? (netPL / collateral) * 100 : 0
}

export function calculateROIPerDay(netPL: number, collateral: number, daysInTrade: number): number {
  if (collateral <= 0 || daysInTrade <= 0) return 0
  const totalROI = (netPL / collateral) * 100
  return totalROI / daysInTrade
}

export function calculateMonthlyROI(netPL: number, collateral: number, daysInTrade: number): number {
  if (collateral <= 0 || daysInTrade <= 0) return 0
  const totalROI = (netPL / collateral) * 100
  
  // If trade was less than 30 days, extrapolate to monthly
  if (daysInTrade < 30) {
    return totalROI * (30 / daysInTrade)
  }
  
  // If trade was more than 30 days, annualize and then convert to monthly
  const annualizedROI = totalROI * (365 / daysInTrade)
  return annualizedROI / 12
}

export function calculateAnnualizedROI(roi: number, daysInTrade: number): number {
  return daysInTrade > 0 ? roi * (365 / daysInTrade) : 0
}

export function calculateDaysInTrade(openDate: Date, closeDate?: Date): number {
  const endDate = closeDate || new Date()
  return Math.max(1, Math.ceil((endDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24)))
}

export function calculateBreakEvenPrice(costBasis: number, totalPremiums: number, shares: number): number {
  return shares > 0 ? costBasis - totalPremiums / shares : 0
}

export function calculateCycleMetrics(
  legs: Leg[],
): Omit<WheelCycle, "id" | "symbol" | "startDate" | "endDate" | "legs"> {
  const totalPremium = legs.reduce((sum, leg) => sum + calculatePremiumIncome(leg.openPrice, leg.contracts, 0), 0)

  const stockLeg = legs.find((leg) => leg.type === "CALL" && leg.closeDate)
  const stockPL = stockLeg ? ((stockLeg.closePrice || 0) - (stockLeg.openPrice || 0)) * 100 * stockLeg.contracts : 0

  const netPL = totalPremium + stockPL

  const earliestDate = legs.reduce(
    (earliest, leg) => (leg.openDate < earliest ? leg.openDate : earliest),
    legs[0]?.openDate || new Date(),
  )

  const latestDate = legs.reduce((latest, leg) => {
    const endDate = leg.closeDate || new Date()
    return endDate > latest ? endDate : latest
  }, earliestDate)

  const daysInTrade = calculateDaysInTrade(earliestDate, latestDate)

  // Estimate collateral as the highest strike * 100 * contracts for puts
  const maxCollateral = legs
    .filter((leg) => leg.type === "PUT")
    .reduce((max, leg) => {
      const collateral = calculateCapitalAtRisk(leg.strike, leg.contracts)
      return collateral > max ? collateral : max
    }, 0)

  const roi = calculateLegROI(netPL, maxCollateral)
  const annualizedROI = calculateAnnualizedROI(roi, daysInTrade)

  return {
    totalPremium,
    totalCommissions: 0,
    netPL,
    roi,
    annualizedROI,
    daysInTrade,
  }
}
