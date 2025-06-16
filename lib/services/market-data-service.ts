import { StockQuote } from "../types"
import { AlphaVantageService, AlphaVantageError } from "./alpha-vantage-service"
import { AlpacaService, AlpacaError } from "./alpaca-service"

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly source: "ALPHA_VANTAGE" | "ALPACA" | "MARKET_DATA",
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'MarketDataError'
  }
}

export class MarketDataService {
  private readonly alphaVantageService: AlphaVantageService
  private readonly alpacaService: AlpacaService | null
  private readonly cache = new Map<string, { data: StockQuote; timestamp: number }>()
  private readonly CACHE_DURATION = 60000 // 1 minute cache

  constructor(alphaVantageService: AlphaVantageService, alpacaService?: AlpacaService) {
    this.alphaVantageService = alphaVantageService
    this.alpacaService = alpacaService || null
  }

  async getQuote(symbol: string): Promise<StockQuote | null> {
    if (!symbol) {
      throw new MarketDataError("Symbol is required", "MARKET_DATA")
    }

    // Check cache first
    const cached = this.cache.get(symbol)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Try Alpha Vantage first
      try {
        const quote = await this.alphaVantageService.getQuote(symbol)
        if (quote) {
          this.cache.set(symbol, { data: quote, timestamp: Date.now() })
          return quote
        }
      } catch (error) {
        // If it's a rate limit error or other Alpha Vantage error, try Alpaca
        if (error instanceof AlphaVantageError && (error.isRateLimit || this.alpacaService)) {
          console.log(`Alpha Vantage failed for ${symbol}, trying Alpaca...`)
          if (this.alpacaService) {
            try {
              const alpacaQuote = await this.alpacaService.getQuote(symbol)
              if (alpacaQuote) {
                this.cache.set(symbol, { data: alpacaQuote, timestamp: Date.now() })
                return alpacaQuote
              }
            } catch (alpacaError) {
              if (alpacaError instanceof AlpacaError) {
                throw new MarketDataError(
                  `Both Alpha Vantage and Alpaca failed for ${symbol}`,
                  "MARKET_DATA",
                  alpacaError
                )
              }
            }
          }
        }
        // If it's not a rate limit error or Alpaca is not available, rethrow
        throw error
      }
    } catch (error) {
      if (error instanceof MarketDataError) {
        throw error
      }
      if (error instanceof AlphaVantageError) {
        throw new MarketDataError(
          `Alpha Vantage error for ${symbol}: ${error.message}`,
          "ALPHA_VANTAGE",
          error
        )
      }
      if (error instanceof AlpacaError) {
        throw new MarketDataError(
          `Alpaca error for ${symbol}: ${error.message}`,
          "ALPACA",
          error
        )
      }
      throw new MarketDataError(
        `Unknown error fetching quote for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "MARKET_DATA",
        error instanceof Error ? error : undefined
      )
    }

    return null
  }

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    if (!symbols.length) {
      return new Map()
    }

    const quotes = new Map<string, StockQuote>()
    const errors: MarketDataError[] = []

    // Process symbols in batches of 5 to avoid rate limits
    for (let i = 0; i < symbols.length; i += 5) {
      const batch = symbols.slice(i, i + 5)
      const promises = batch.map(async (symbol) => {
        try {
          const quote = await this.getQuote(symbol)
          if (quote) {
            quotes.set(symbol, quote)
          }
        } catch (error) {
          if (error instanceof MarketDataError) {
            errors.push(error)
          }
        }
      })
      await Promise.all(promises)
      
      // Add a small delay between batches
      if (i + 5 < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Log any errors that occurred
    if (errors.length > 0) {
      console.error("Errors occurred while fetching quotes:", errors)
    }

    return quotes
  }
} 