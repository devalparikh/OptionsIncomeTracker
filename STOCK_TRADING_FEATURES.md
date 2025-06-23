# Stock Trading Features

This document explains the new stock trading features that implement FIFO (First In, First Out) lot tracking and closed position storage, similar to the C# implementation.

## Overview

The system now tracks individual stock trades and implements proper FIFO accounting for realized profit/loss calculations. When stock positions are fully closed, they are stored in a separate table for historical analysis.

## New Database Tables

### 1. `stock_trades` Table

Tracks individual buy and sell transactions for stock positions:

```sql
CREATE TABLE stock_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE NOT NULL,
  side TEXT CHECK (side IN ('BUY', 'SELL')) NOT NULL,
  quantity DECIMAL(15,6) NOT NULL, -- Supports fractional shares
  price DECIMAL(10,2) NOT NULL,
  trade_date DATE NOT NULL,
  close_date DATE, -- When this lot was closed (for BUY trades)
  close_price DECIMAL(10,2), -- Price at which this lot was closed
  realized_pnl DECIMAL(15,2) DEFAULT 0, -- Realized PnL for this lot
  is_closed BOOLEAN DEFAULT FALSE, -- Whether this lot has been fully closed
  commissions DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. `closed_stock_positions` Table

Stores summary information for fully closed stock positions:

```sql
CREATE TABLE closed_stock_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  total_quantity DECIMAL(15,6) NOT NULL, -- Total shares that were closed
  total_cost_basis DECIMAL(15,2) NOT NULL, -- Total cost basis of closed shares
  total_proceeds DECIMAL(15,2) NOT NULL, -- Total proceeds from selling shares
  total_realized_pnl DECIMAL(15,2) NOT NULL, -- Total realized PnL
  first_buy_date DATE NOT NULL, -- Date of first buy in this position
  last_sell_date DATE NOT NULL, -- Date of last sell that closed the position
  trade_count INTEGER NOT NULL, -- Number of trades in this closed position
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## FIFO Trading Logic

### Buy Transactions

When a stock is purchased:

1. **Create/Update Position**: Add shares to existing position or create new position
2. **Record Buy Trade**: Store individual buy transaction in `stock_trades` table
3. **Update Cost Basis**: Calculate weighted average cost basis for the position

### Sell Transactions

When stock is sold, the system implements FIFO logic:

1. **Get Open Lots**: Retrieve all unclosed buy lots, ordered by date (oldest first)
2. **Process FIFO**: Sell shares from oldest lots first
3. **Calculate PnL**: For each lot sold, calculate realized PnL as `(sale_price - buy_price) * quantity`
4. **Update Lots**: Mark sold lots as closed or partially close them
5. **Record Sell Trade**: Store the sell transaction
6. **Create Closed Position**: If position is fully closed, create summary record

### Example FIFO Scenario

```
Buy 100 shares @ $50 on Jan 1
Buy 50 shares @ $60 on Jan 15
Sell 120 shares @ $70 on Jan 30

FIFO Processing:
- Sell 100 shares from Jan 1 lot: PnL = (70-50) * 100 = $2,000
- Sell 20 shares from Jan 15 lot: PnL = (70-60) * 20 = $200
- Remaining: 30 shares from Jan 15 lot @ $60
- Total Realized PnL: $2,200
```

## API Endpoints

### 1. Robinhood Upload (`/api/upload/robinhood`)

Updated to implement FIFO logic for stock trades:

- **Buy Orders**: Create `stock_trades` records with `side = 'BUY'`
- **Sell Orders**: Process FIFO logic and create `stock_trades` records with `side = 'SELL'`
- **Closed Positions**: Automatically create `closed_stock_positions` records when positions are fully closed

### 2. Closed Stock Positions (`/api/closed-stock-positions`)

Retrieves closed stock positions for display:

```typescript
GET /api/closed-stock-positions
Response: {
  closedPositions: [
    {
      id: string
      symbol: string
      total_quantity: number
      total_cost_basis: number
      total_proceeds: number
      total_realized_pnl: number
      first_buy_date: string
      last_sell_date: string
      trade_count: number
    }
  ]
}
```

## React Components

### `ClosedStockPositions` Component

Displays closed stock positions with:

- **Position Cards**: Show symbol, quantity, cost basis, proceeds, and PnL
- **PnL Badges**: Color-coded (green for profit, red for loss)
- **Date Information**: First buy and last sell dates
- **Summary**: Total realized PnL across all closed positions

## Migration

### For New Installations

Use the updated schema:

```bash
psql -d your_database -f scripts/create-tables-v6.sql
```

### For Existing Installations

Run the migration script:

```bash
# Backup first
pg_dump your_database > backup_before_stock_trades_migration.sql

# Run migration
psql -d your_database -f scripts/migrate-to-stock-trades.sql
```

## Benefits

1. **Accurate PnL Tracking**: FIFO ensures proper cost basis calculations
2. **Tax Compliance**: Matches IRS requirements for stock trading
3. **Historical Analysis**: Complete trade history and closed position summaries
4. **Fractional Share Support**: Handles fractional shares from Robinhood
5. **Audit Trail**: Individual trade records for verification

## Comparison with C# Implementation

The TypeScript implementation mirrors the C# logic:

- **Tax Lots**: `stock_trades` table replaces the `taxLots` array
- **FIFO Processing**: Same algorithm for processing sells against oldest buys first
- **Closed Lots**: `closed_stock_positions` table stores summary data
- **Realized PnL**: Calculated using the same formula: `proceeds - cost_basis`

## Usage

1. **Upload Robinhood CSV**: Stock trades are automatically processed with FIFO logic
2. **View Closed Positions**: Use the `ClosedStockPositions` component to see historical performance
3. **Monitor PnL**: Track realized gains/losses across all closed positions

The system now provides comprehensive stock trading functionality that matches professional trading platforms and accounting requirements.
