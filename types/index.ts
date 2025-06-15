export interface User {
  id: string
  email: string
  role: "individual" | "advisor"
  createdAt: Date
}

export interface Account {
  id: string
  userId: string
  name: string
  brokerName?: string
  accountNumber?: string
}

export interface Portfolio {
  id: string
  accountId: string
  name: string
  cash: number
  totalEquity: number
}

export type PositionStatus = "PUT" | "STOCK" | "CALL"
export type OptionType = "PUT" | "CALL"
export type LegSide = "SELL" | "BUY"

export interface Position {
  id: string
  portfolioId: string
  symbol: string
  status: PositionStatus
  quantity: number
  costBasis?: number
  currentPrice?: number
  legs: Leg[]
  createdAt: Date
  updatedAt: Date
}

export interface Leg {
  id: string
  positionId: string
  side: LegSide
  type: OptionType
  strike: number
  expiry: Date
  openDate: Date
  openPrice: number
  closeDate?: Date
  closePrice?: number
  contracts: number
  commissions: number
  isAssigned?: boolean
  isExercised?: boolean
}

export interface Transaction {
  id: string
  portfolioId: string
  legId?: string
  type: "PREMIUM" | "ASSIGNMENT" | "EXERCISE" | "DIVIDEND" | "COMMISSION"
  amount: number
  date: Date
  description: string
}

export interface WheelCycle {
  id: string
  symbol: string
  startDate: Date
  endDate?: Date
  legs: Leg[]
  totalPremium: number
  totalCommissions: number
  netPL: number
  roi: number
  annualizedROI: number
  daysInTrade: number
}
