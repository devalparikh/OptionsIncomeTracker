import { TradeActivity, ActivityType } from './trade'

export class SharePosition {
  public quantity: number = 0
  public realizedPnL: number = 0
  public symbol: string
  private totalCost: number = 0
  private taxLots: Array<{ trade: TradeActivity; date: Date }> = []

  constructor(symbol: string) {
    this.symbol = symbol
  }

  get costBasis(): number {
    return this.quantity === 0 ? 0 : this.totalCost / this.quantity
  }

  buy(trade: TradeActivity): void {
    const pricePerShare = trade.price!
    const sharesPurchased = trade.quantity!
    this.totalCost += pricePerShare * sharesPurchased
    this.quantity += sharesPurchased

    this.taxLots.push({ trade, date: trade.date })
    // Sort by date (FIFO)
    this.taxLots.sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  sell(quantityToSell: number, salePricePerShare: number): number {
    if (quantityToSell <= 0) throw new Error('Quantity to sell must be positive')
    if (salePricePerShare <= 0) throw new Error('Sale price must be positive')

    let realizedPnL = 0
    let remainingToSell = quantityToSell

    while (remainingToSell > 0 && this.taxLots.length > 0) {
      const lot = this.taxLots.shift()!
      const lotSellQty = Math.min(remainingToSell, lot.trade.quantity!)
      const lotCostBasis = lot.trade.price!
      const proceeds = salePricePerShare * lotSellQty
      const cost = lotCostBasis * lotSellQty
      realizedPnL += proceeds - cost

      this.quantity -= lotSellQty
      this.totalCost -= cost

      const isEntireLotSold = lotSellQty === lot.trade.quantity
      if (!isEntireLotSold) {
        // Partially consume the front lot
        lot.trade.quantity! -= lotSellQty
        lot.trade.notes = (lot.trade.notes || '') + ' Closed via Sell'
        this.taxLots.unshift(lot)
      }

      remainingToSell -= lotSellQty
    }

    this.realizedPnL += realizedPnL
    return realizedPnL
  }
}

export class OptionPosition {
  private static readonly CONTRACT_MULTIPLIER = 100 // 1 contract = 100 shares
  private taxLots: Array<{ trade: TradeActivity; date: Date }> = []
  private closedLots: Array<{ 
    originalTrade: TradeActivity; 
    openDate: Date; 
    closeTrade: TradeActivity; 
    closeDate: Date 
  }> = []
  public quantity: number = 0 // open SHORT contracts
  public realizedPnL: number = 0
  public symbol: string
  public totalCredit: number = 0 // running premium collected
  public isClosed: boolean = false

  constructor(symbol: string) {
    this.symbol = symbol
  }

  sellToOpen(trade: TradeActivity): void {
    const credit = trade.price! * trade.quantity! * OptionPosition.CONTRACT_MULTIPLIER
    this.totalCredit += credit
    this.quantity += trade.quantity!
    
    this.taxLots.push({ trade, date: trade.date })
    // Sort by date (FIFO)
    this.taxLots.sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  buyToClose(contractsToClose: number, debitPerContract: number, closeDate: Date, closeTrade: TradeActivity): number {
    if (contractsToClose <= 0) throw new Error('Contracts to close must be positive')
    if (debitPerContract < 0) throw new Error('Debit per contract must be non-negative')

    let realized = 0
    let remainingToClose = contractsToClose

    while (remainingToClose > 0 && this.taxLots.length > 0) {
      const lot = this.taxLots.shift()!
      const lotQty = Math.min(remainingToClose, lot.trade.quantity!)

      const lotCredit = lot.trade.price! * lotQty * OptionPosition.CONTRACT_MULTIPLIER
      const lotDebit = debitPerContract * lotQty * OptionPosition.CONTRACT_MULTIPLIER

      realized += lotCredit - lotDebit
      this.quantity -= lotQty
      this.totalCredit -= lotCredit

      const entireLotClosed = lotQty === lot.trade.quantity
      if (entireLotClosed) {
        this.closedLots.push({ 
          originalTrade: lot.trade, 
          openDate: lot.date, 
          closeTrade: closeTrade, 
          closeDate 
        })
      } else {
        // partial lot close
        lot.trade.quantity! -= lotQty
        lot.trade.notes = (lot.trade.notes || '') + ' Closed via BTC'
        this.taxLots.unshift(lot)
      }

      remainingToClose -= lotQty
    }

    this.realizedPnL += realized
    
    // Check if position is fully closed
    if (this.quantity === 0) {
      this.isClosed = true
    }
    
    return realized
  }

  expire(expiryDate: Date, expireTrade: TradeActivity): number {
    let realized = 0

    while (this.taxLots.length > 0) {
      const lot = this.taxLots.shift()!
      realized += lot.trade.price! * lot.trade.quantity! * OptionPosition.CONTRACT_MULTIPLIER
      this.closedLots.push({ 
        originalTrade: lot.trade, 
        openDate: lot.date, 
        closeTrade: expireTrade, 
        closeDate: expiryDate 
      })
    }

    this.resetPosition()
    this.realizedPnL += realized
    this.isClosed = true
    return realized
  }

  assign(assignmentDate: Date, assignTrade: TradeActivity): number {
    const result = this.expire(assignmentDate, assignTrade)
    // keep premium, position flattened
    this.isClosed = true
    return result
  }

  private resetPosition(): void {
    this.taxLots = []
    this.quantity = 0
    this.totalCredit = 0
  }

  get closedLotsCount(): number {
    return this.closedLots.length
  }

  get totalContractsClosed(): number {
    return this.closedLots.reduce((total, lot) => total + lot.originalTrade.quantity!, 0)
  }

  get closedLotsData(): Array<{ 
    originalTrade: TradeActivity; 
    openDate: Date; 
    closeTrade: TradeActivity; 
    closeDate: Date 
  }> {
    return [...this.closedLots]
  }
}

export class Portfolio {
  public sharePositions: Map<string, SharePosition> = new Map()
  public optionsPositions: Map<string, OptionPosition> = new Map()
  public realizedPnL: number = 0

  loadShares(trades: TradeActivity[]): void {
    for (const trade of trades) {
      if (!this.sharePositions.has(trade.symbol!)) {
        this.sharePositions.set(trade.symbol!, new SharePosition(trade.symbol!))
      }

      // Includes orders and assignments
      if (trade.type === ActivityType.Buy) {
        this.sharePositions.get(trade.symbol!)!.buy(trade)
      }
      if (trade.type === ActivityType.Sell) {
        this.realizedPnL += this.sharePositions.get(trade.symbol!)!.sell(trade.quantity!, trade.price!)
      }
    }
  }

  loadOptions(trades: TradeActivity[]): void {
    for (const trade of trades.filter(t => t.isOption)) {
      // TODO make key unique by contract
      // "key" should encodes underlying/expiry/strike/type
      const key = trade.symbol!
      const occKey = `${trade.symbol!}_${trade.expiration!}_${trade.strikePrice}_${trade.optionType}`
      
      if (!this.optionsPositions.has(key)) {
        this.optionsPositions.set(key, new OptionPosition(key))
      }

      const qty = trade.quantity
      const price = trade.price // price is premium per contract

      switch (trade.type) {
        case ActivityType.STO: // Sell‑to‑Open
          this.optionsPositions.get(key)!.sellToOpen(trade)
          break

        case ActivityType.BTC: // Buy‑to‑Close
          this.realizedPnL += this.optionsPositions.get(key)!
            .buyToClose(qty!, price!, trade.date, trade)
          break

        case ActivityType.Expired: // Expired worthless
          this.realizedPnL += this.optionsPositions.get(key)!.expire(trade.date, trade)
          break

        case ActivityType.Assignment: // Assigned
          this.realizedPnL += this.optionsPositions.get(key)!.assign(trade.date, trade)
          break
      }
    }
  }

  get openOptionsPositions(): Map<string, OptionPosition> {
    const openPositions = new Map<string, OptionPosition>()
    for (const [symbol, position] of this.optionsPositions) {
      if (!position.isClosed) {
        openPositions.set(symbol, position)
      }
    }
    return openPositions
  }

  get closedOptionsPositions(): Map<string, OptionPosition> {
    const closedPositions = new Map<string, OptionPosition>()
    for (const [symbol, position] of this.optionsPositions) {
      if (position.isClosed) {
        closedPositions.set(symbol, position)
      }
    }
    return closedPositions
  }
} 