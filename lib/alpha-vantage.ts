// This file is kept for backward compatibility but should not be used directly
// Use the server actions in app/actions/market-data.ts instead
import { getMarketDataService } from "./services"

// Re-export everything from the services directory
export { getMarketDataService, getAlphaVantageService, getAlpacaService } from "./services"
export { AlphaVantageError, AlpacaError } from "./services"
export type { StockQuote } from "./types"

// For backward compatibility only - DO NOT USE IN NEW CODE
// Use getStockQuotes from app/actions/market-data.ts instead
export const getAlphaVantageClient = getMarketDataService
