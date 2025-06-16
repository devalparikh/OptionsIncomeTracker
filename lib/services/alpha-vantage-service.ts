import { StockQuote, AlphaVantageResponse } from "../types"
import { AlpacaService } from "./alpaca-service"

export class AlphaVantageError extends Error {
  constructor(
    message: string,
    public readonly isRateLimit: boolean = false,
    public readonly apiKey?: string
  ) {
    super(message)
    this.name = 'AlphaVantageError'
  }
}

export class AlphaVantageService {
  private readonly baseUrl = "https://www.alphavantage.co/query"
  private readonly apiKey: string
  private readonly cache = new Map<string, { data: StockQuote; timestamp: number }>()
  private readonly CACHE_DURATION = 60000 // 1 minute cache
  private readonly alpacaService: AlpacaService | null

  constructor(apiKey: string, alpacaService?: AlpacaService) {
    if (!apiKey) {
      throw new Error("Alpha Vantage API key is required")
    }
    this.apiKey = apiKey
    this.alpacaService = alpacaService || null
  }

  async getQuote(symbol: string): Promise<StockQuote | null> {
    if (!symbol) {
      throw new Error("Symbol is required")
    }

    // Check cache first
    const cached = this.cache.get(symbol)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new AlphaVantageError(`HTTP error! status: ${response.status}`)
      }

      const data: AlphaVantageResponse = await response.json()

      // Check for rate limit error
      if (data.Information && data.Information.includes("API rate limit")) {
        const apiKey = data.Information.match(/API key as ([A-Z0-9]+)/)?.[1]
        console.log("Alpha Vantage rate limit hit, falling back to Alpaca")
        
        if (this.alpacaService) {
          try {
            const alpacaQuote = await this.alpacaService.getQuote(symbol)
            if (alpacaQuote) {
              this.cache.set(symbol, { data: alpacaQuote, timestamp: Date.now() })
              return alpacaQuote
            }
          } catch (alpacaError) {
            console.error("Alpaca fallback failed:", alpacaError)
          }
        }
        throw new AlphaVantageError(data.Information, true, apiKey)
      }

      // Check for other API errors
      if (data["Error Message"]) {
        throw new AlphaVantageError(data["Error Message"])
      }

      if (data.Note && data.Note.includes("API call frequency")) {
        throw new AlphaVantageError(data.Note, true)
      }

      if (!data["Global Quote"]) {
        throw new AlphaVantageError(`No quote data returned for ${symbol}`)
      }

      const quote = data["Global Quote"]
      if (!quote["05. price"]) {
        throw new AlphaVantageError(`Invalid quote data for ${symbol}`)
      }

      const stockQuote: StockQuote = {
        symbol: quote["01. symbol"],
        price: Number.parseFloat(quote["05. price"]),
        change: Number.parseFloat(quote["09. change"]),
        changePercent: Number.parseFloat(quote["10. change percent"].replace("%", "")),
        lastUpdated: quote["07. latest trading day"],
        open: Number.parseFloat(quote["02. open"]),
        high: Number.parseFloat(quote["03. high"]),
        low: Number.parseFloat(quote["04. low"]),
        volume: Number.parseInt(quote["06. volume"]),
      }

      // Cache the result
      this.cache.set(symbol, { data: stockQuote, timestamp: Date.now() })
      return stockQuote

    } catch (error) {
      if (error instanceof AlphaVantageError) {
        throw error
      }
      throw new AlphaVantageError(
        `Error fetching quote for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    if (!symbols.length) {
      return new Map()
    }

    const quotes = new Map<string, StockQuote>()
    const errors: AlphaVantageError[] = []

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
          if (error instanceof AlphaVantageError) {
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