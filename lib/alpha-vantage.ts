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

export class AlphaVantageClient {
  private apiKey: string
  private baseUrl = "https://www.alphavantage.co/query"
  private cache = new Map<string, { data: StockQuote; timestamp: number }>()
  private readonly CACHE_DURATION = 60000 // 1 minute cache

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async getQuote(symbol: string): Promise<StockQuote | null> {
    // Check cache first
    const cached = this.cache.get(symbol)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: AlphaVantageResponse = await response.json()

      // Check for API errors
      if (data["Error Message"]) {
        console.error(`Alpha Vantage API error for ${symbol}:`, data["Error Message"])
        return null
      }

      if (data["Note"]) {
        console.warn(`Alpha Vantage API note for ${symbol}:`, data["Note"])
        return null
      }

      if (!data["Global Quote"]) {
        console.error(`No quote data returned for ${symbol}`)
        return null
      }

      const quote = data["Global Quote"]
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
      console.error(`Error fetching quote for ${symbol}:`, error)
      return null
    }
  }

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const quotes = new Map<string, StockQuote>()

    // Process in batches to avoid rate limiting
    const batchSize = 5
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const promises = batch.map((symbol) => this.getQuote(symbol))
      const results = await Promise.all(promises)

      results.forEach((quote, index) => {
        if (quote) {
          quotes.set(batch[index], quote)
        }
      })

      // Add delay between batches to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return quotes
  }
}

// Singleton instance
let alphaVantageClient: AlphaVantageClient | null = null

export function getAlphaVantageClient(): AlphaVantageClient {
  if (!alphaVantageClient) {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY
    if (!apiKey) {
      throw new Error("ALPHA_VANTAGE_API_KEY environment variable is required")
    }
    alphaVantageClient = new AlphaVantageClient(apiKey)
  }
  return alphaVantageClient
}
