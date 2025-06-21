export interface TradeActivity {
  date: Date
  symbol?: string
  type: ActivityType
  quantity?: number
  price?: number
  amount?: number
  notes?: string

  // Option-specific fields
  isOption: boolean
  underlying?: string
  expiration?: Date
  strikePrice?: number
  optionType?: OptionType
}

export enum ActivityType {
  Unknown = 'Unknown',
  Buy = 'Buy',
  Sell = 'Sell',
  STO = 'STO', // Sell to Open
  BTC = 'BTC', // Buy to Close
  Assignment = 'Assignment',
  Expired = 'Expired',
  Dividend = 'Dividend',
  Interest = 'Interest',
  Transfer = 'Transfer',
  Other = 'Other'
}

export enum OptionType {
  Call = 'Call',
  Put = 'Put'
} 