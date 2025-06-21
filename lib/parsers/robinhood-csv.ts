import { parse } from 'csv-parse/sync'
import { TradeActivity, ActivityType, OptionType } from '../types/trade'

interface RobinhoodCsvRow {
  'Activity Date': string
  'Process Date': string
  'Settle Date': string
  'Instrument': string
  'Description': string
  'Trans Code': string
  'Quantity': string
  'Price': string
  'Amount': string
}

export class RobinhoodCsvParser {
  static loadCsv(csvText: string): TradeActivity[] {
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as RobinhoodCsvRow[]

    return records
      .filter(r => r['Activity Date']) // skip rows with missing date
      .map(RobinhoodCsvParser.toTradeActivity)
      .filter(Boolean) as TradeActivity[]
  }

  private static toTradeActivity(row: RobinhoodCsvRow): TradeActivity {
    const activity: TradeActivity = {
      date: new Date(row['Activity Date']),
      symbol: row['Instrument'],
      type: RobinhoodCsvParser.mapActivityType(row['Trans Code'], row['Description']),
      quantity: RobinhoodCsvParser.parseDecimal(row['Quantity']),
      price: RobinhoodCsvParser.parseDecimal(row['Price']),
      amount: RobinhoodCsvParser.parseDecimal(row['Amount']),
      notes: row['Description'],
      isOption: false,
    }

    if (RobinhoodCsvParser.tryParseOptionContract(row['Description'], activity)) {
      activity.isOption = true
    }

    return activity
  }

  private static parseDecimal(text: string): number | undefined {
    if (!text || text.trim() === '') return undefined

    const cleanText = text.trim()
      .replace(/[$]/g, '')
      .replace(/[,]/g, '')

    let negative = false
    let parseText = cleanText

    if (cleanText.startsWith('(') && cleanText.endsWith(')')) {
      negative = true
      parseText = cleanText.slice(1, -1) // drop the parentheses
    }

    const val = parseFloat(parseText)
    if (isNaN(val)) return undefined

    return negative ? -val : val
  }

  private static tryParseOptionContract(
    description: string,
    activity: TradeActivity
  ): boolean {
    if (!description || description.trim() === '') return false

    const parts = description.split(' ').filter(part => part.trim() !== '')
    if (parts.length !== 4) return false

    try {
      const underlying = parts[0]
      const dateStr = parts[1]
      const optionTypeStr = parts[2]
      const strikeStr = parts[3]

      // Parse date
      const expiration = new Date(dateStr)
      if (isNaN(expiration.getTime())) return false

      // Parse option type
      const optionType = optionTypeStr.toLowerCase() === 'call' 
        ? OptionType.Call 
        : optionTypeStr.toLowerCase() === 'put' 
          ? OptionType.Put 
          : undefined

      if (!optionType) return false

      // Parse strike price
      const strikeText = strikeStr.trim().replace(/^\$/, '')
      const strike = parseFloat(strikeText)
      if (isNaN(strike)) return false

      // Set option-specific fields
      activity.underlying = underlying
      activity.expiration = expiration
      activity.strikePrice = strike
      activity.optionType = optionType

      return true
    } catch {
      return false
    }
  }

  private static mapActivityType(code: string, description: string): ActivityType {
    const cleanCode = code?.trim().toUpperCase() || ''
    const cleanDescription = description?.toLowerCase() || ''

    switch (cleanCode) {
      case 'BUY':
        return ActivityType.Buy
      case 'SELL':
        return ActivityType.Sell
      case 'STO':
        return ActivityType.STO
      case 'BTC':
        return ActivityType.BTC
      case 'OASGN':
        return ActivityType.Assignment
      case 'EXP':
        return ActivityType.Expired
      case 'DIV':
        return ActivityType.Dividend
      case 'INT':
        return ActivityType.Interest
      case 'XFER':
        return ActivityType.Transfer
      default:
        // Check description for additional context
        if (cleanDescription.includes('assignment')) return ActivityType.Assignment
        if (cleanDescription.includes('expire')) return ActivityType.Expired
        if (cleanDescription.includes('dividend')) return ActivityType.Dividend
        return ActivityType.Unknown
    }
  }
} 