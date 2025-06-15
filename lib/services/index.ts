import { AlphaVantageService } from "./alpha-vantage-service"
import { AlpacaService } from "./alpaca-service"
import { MarketDataService, MarketDataError } from "./market-data-service"
import type { StockQuote } from "../types"

export { AlphaVantageError } from "./alpha-vantage-service"
export { AlpacaError } from "./alpaca-service"
export { MarketDataError } from "./market-data-service"
export type { StockQuote }

// Singleton instances
let marketDataService: MarketDataService | null = null
let alphaVantageService: AlphaVantageService | null = null
let alpacaService: AlpacaService | null = null

export function getMarketDataService(): MarketDataService {
  if (!marketDataService) {
    // Initialize Alpha Vantage service
    if (!alphaVantageService) {
      const apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY
      if (!apiKey) {
        throw new Error("ALPHA_VANTAGE_API_KEY environment variable is required")
      }
      alphaVantageService = new AlphaVantageService(apiKey)
    }

    // Initialize Alpaca service if credentials are available
    if (!alpacaService) {
      const alpacaApiKey = process.env.NEXT_PUBLIC_ALPACA_API_KEY
      const alpacaSecretKey = process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY
      if (alpacaApiKey && alpacaSecretKey) {
        alpacaService = new AlpacaService(alpacaApiKey, alpacaSecretKey)
      }
    }

    marketDataService = new MarketDataService(alphaVantageService, alpacaService || undefined)
  }
  return marketDataService
}

// Keep these for direct access if needed
export function getAlphaVantageService(): AlphaVantageService {
  if (!alphaVantageService) {
    const apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY
    if (!apiKey) {
      throw new Error("ALPHA_VANTAGE_API_KEY environment variable is required")
    }
    alphaVantageService = new AlphaVantageService(apiKey)
  }
  return alphaVantageService
}

export function getAlpacaService(): AlpacaService | null {
  if (!alpacaService) {
    const apiKey = process.env.NEXT_PUBLIC_ALPACA_API_KEY
    const secretKey = process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY
    if (apiKey && secretKey) {
      alpacaService = new AlpacaService(apiKey, secretKey)
    }
  }
  return alpacaService
} 