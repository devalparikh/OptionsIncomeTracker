import Alpaca from '@alpacahq/alpaca-trade-api'

interface AlphaVantageQuote {
  "01. symbol": string
  "02. open": string
  "03. high": string
  "04. low": string
  "05. price": string
  "06. volume": string
  "07. latest trading day": string
  "08. previous close": string
  "09. change": string
  "10. change percent": string
}

interface AlphaVantageResponse {
  "Global Quote": AlphaVantageQuote
  "Error Message"?: string
  Note?: string
  Information?: string
}

export interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  lastUpdated: string
  open: number
  high: number
  low: number
  volume: number
}

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

export class AlphaVantageClient {
  private apiKey: string
  private baseUrl = "https://www.alphavantage.co/query"
  private cache = new Map<string, { data: StockQuote; timestamp: number }>()
  private readonly CACHE_DURATION = 60000 // 1 minute cache
  private readonly alpacaBaseUrl = "https://data.alpaca.markets/v2"
  private readonly alpacaApiKey: string
  private readonly alpacaSecretKey: string

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Alpha Vantage API key is required")
    }
    this.apiKey = apiKey

    if (!process.env.NEXT_PUBLIC_ALPACA_API_KEY || !process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY) {
      console.warn("Alpaca API credentials not found. Backup API will not be available.")
    }
    this.alpacaApiKey = process.env.NEXT_PUBLIC_ALPACA_API_KEY || ''
    this.alpacaSecretKey = process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY || ''
  }

  private async getQuoteFromAlpaca(symbol: string): Promise<StockQuote | null> {
    if (!this.alpacaApiKey || !this.alpacaSecretKey) {
      throw new AlpacaError("Alpaca API credentials not configured")
    }

    try {
      const headers = {
        'APCA-API-KEY-ID': this.alpacaApiKey,
        'APCA-API-SECRET-KEY': this.alpacaSecretKey
      }

      // Get latest quote
      const quoteResponse = await fetch(
        `${this.alpacaBaseUrl}/stocks/${symbol}/quotes/latest`,
        { headers }
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
      console.log("quote from alpaca", quoteData)
      
      if (!quoteData?.quote?.bp) {
        throw new AlpacaError(`Invalid quote data for ${symbol}`)
      }

      const quote = quoteData.quote

      // Get latest trade
      const tradeResponse = await fetch(
        `${this.alpacaBaseUrl}/stocks/${symbol}/trades/latest`,
        { headers }
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
        try {
          const alpacaQuote = await this.getQuoteFromAlpaca(symbol)
          if (alpacaQuote) {
            this.cache.set(symbol, { data: alpacaQuote, timestamp: Date.now() })
            return alpacaQuote
          }
        } catch (alpacaError) {
          console.error("Alpaca fallback failed:", alpacaError)
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
    const errors: (AlphaVantageError | AlpacaError)[] = []

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
          if (error instanceof AlphaVantageError || error instanceof AlpacaError) {
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

// Singleton instance
let alphaVantageClient: AlphaVantageClient | null = null

export function getAlphaVantageClient(): AlphaVantageClient {
  if (!alphaVantageClient) {
    const apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY
    if (!apiKey) {
      throw new Error("ALPHA_VANTAGE_API_KEY environment variable is required")
    }
    alphaVantageClient = new AlphaVantageClient(apiKey)
  }
  return alphaVantageClient
}
