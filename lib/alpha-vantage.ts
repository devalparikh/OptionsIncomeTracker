import { getMarketDataService } from "./services"

// Re-export everything from the services directory
export { getMarketDataService, getAlphaVantageService, getAlpacaService } from "./services"
export { AlphaVantageError, AlpacaError, MarketDataError } from "./services"
export type { StockQuote } from "./types"

// For backward compatibility
export const getAlphaVantageClient = getMarketDataService
