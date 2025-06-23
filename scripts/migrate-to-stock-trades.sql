-- Migration script to add stock_trades and closed_stock_positions tables
-- Run this script to update your existing database schema

-- First, backup your data (recommended)
-- pg_dump your_database > backup_before_stock_trades_migration.sql

-- Create stock_trades table to track individual stock buy/sell transactions (FIFO lots)
CREATE TABLE IF NOT EXISTS stock_trades (
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

-- Create closed_stock_positions table to display closed stock positions with PnL
CREATE TABLE IF NOT EXISTS closed_stock_positions (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_trades_position_id ON stock_trades(position_id);
CREATE INDEX IF NOT EXISTS idx_stock_trades_date ON stock_trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_stock_trades_is_closed ON stock_trades(is_closed);
CREATE INDEX IF NOT EXISTS idx_closed_stock_positions_portfolio_id ON closed_stock_positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_closed_stock_positions_symbol ON closed_stock_positions(symbol);

-- Enable Row Level Security
ALTER TABLE stock_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_stock_positions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for stock_trades
CREATE POLICY "Users can view own stock_trades" ON stock_trades FOR SELECT USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    JOIN positions pos ON pos.portfolio_id = p.id
    WHERE pos.id = position_id
  )
);
CREATE POLICY "Users can insert own stock_trades" ON stock_trades FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    JOIN positions pos ON pos.portfolio_id = p.id
    WHERE pos.id = position_id
  )
);
CREATE POLICY "Users can update own stock_trades" ON stock_trades FOR UPDATE USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    JOIN positions pos ON pos.portfolio_id = p.id
    WHERE pos.id = position_id
  )
);
CREATE POLICY "Users can delete own stock_trades" ON stock_trades FOR DELETE USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    JOIN positions pos ON pos.portfolio_id = p.id
    WHERE pos.id = position_id
  )
);

-- Create RLS policies for closed_stock_positions
CREATE POLICY "Users can view own closed_stock_positions" ON closed_stock_positions FOR SELECT USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);
CREATE POLICY "Users can insert own closed_stock_positions" ON closed_stock_positions FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);
CREATE POLICY "Users can update own closed_stock_positions" ON closed_stock_positions FOR UPDATE USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);
CREATE POLICY "Users can delete own closed_stock_positions" ON closed_stock_positions FOR DELETE USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);

-- Create trigger for updated_at on new tables
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON stock_trades FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON closed_stock_positions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Verify the changes
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('stock_trades', 'closed_stock_positions')
ORDER BY table_name, column_name;

-- Show sample of new tables (empty initially)
SELECT 'stock_trades' as table_name, COUNT(*) as row_count FROM stock_trades
UNION ALL
SELECT 'closed_stock_positions' as table_name, COUNT(*) as row_count FROM closed_stock_positions; 