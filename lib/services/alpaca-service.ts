import { StockQuote } from "../types"

export class AlpacaError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'AlpacaError'
  }
}

export class AlpacaService {
  private readonly baseUrl = "https://data.alpaca.markets/v2"
  private readonly apiKey: string
  private readonly secretKey: string

  constructor(apiKey: string, secretKey: string) {
    if (!apiKey || !secretKey) {
      throw new Error("Alpaca API credentials are required")
    }
    this.apiKey = apiKey
    this.secretKey = secretKey
  }

  private getHeaders() {
    return {
      'APCA-API-KEY-ID': this.apiKey,
      'APCA-API-SECRET-KEY': this.secretKey
    }
  }

  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      // Get latest quote
      const quoteResponse = await fetch(
        `${this.baseUrl}/stocks/${symbol}/quotes/latest`,
        { headers: this.getHeaders() }
      )
      
      if (!quoteResponse.ok) {
        const errorData = await quoteResponse.json().catch(() => ({}))
        throw new AlpacaError(
          `Alpaca quote API error: ${errorData.message || quoteResponse.statusText}`,
          quoteResponse.status,
          errorData.code
        )
      }

      const quoteData = await quoteResponse.json()
      
      if (!quoteData?.quote?.bp) {
        throw new AlpacaError(`Invalid quote data for ${symbol}`)
      }

      const quote = quoteData.quote

      // Get latest trade
      const tradeResponse = await fetch(
        `${this.baseUrl}/stocks/${symbol}/trades/latest`,
        { headers: this.getHeaders() }
      )

      if (!tradeResponse.ok) {
        const errorData = await tradeResponse.json().catch(() => ({}))
        throw new AlpacaError(
          `Alpaca trade API error: ${errorData.message || tradeResponse.statusText}`,
          tradeResponse.status,
          errorData.code
        )
      }

      const tradeData = await tradeResponse.json()
      if (!tradeData?.trade?.p || !tradeData?.trade?.t) {
        throw new AlpacaError(`Invalid trade data for ${symbol}`)
      }

      const trade = tradeData.trade

      return {
        symbol,
        price: trade.p,
        change: trade.p - quote.bp,
        changePercent: ((trade.p - quote.bp) / quote.bp) * 100,
        lastUpdated: new Date(trade.t).toISOString(),
        open: trade.p,
        high: trade.p,
        low: trade.p,
        volume: trade.s
      }
    } catch (error) {
      if (error instanceof AlpacaError) {
        throw error
      }
      throw new AlpacaError(
        `Error fetching Alpaca data for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    if (!symbols.length) {
      return new Map()
    }

    const quotes = new Map<string, StockQuote>()
    const errors: AlpacaError[] = []

    // Process symbols in parallel
    const promises = symbols.map(async (symbol) => {
      try {
        const quote = await this.getQuote(symbol)
        if (quote) {
          quotes.set(symbol, quote)
        }
      } catch (error) {
        if (error instanceof AlpacaError) {
          errors.push(error)
        }
      }
    })

    await Promise.all(promises)

    if (errors.length > 0) {
      console.error("Errors occurred while fetching Alpaca quotes:", errors)
    }

    return quotes
  }
} 