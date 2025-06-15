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

export interface AlphaVantageResponse {
  "Global Quote"?: {
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
  "Error Message"?: string
  Note?: string
  Information?: string
} 