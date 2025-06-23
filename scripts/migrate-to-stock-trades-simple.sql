-- Simple migration script to add stock_trades and closed_stock_positions tables
-- Run this script to update your existing database schema

-- First, backup your data (recommended)
-- pg_dump your_database > backup_before_stock_trades_migration.sql

-- Create stock_trades table
CREATE TABLE IF NOT EXISTS stock_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE NOT NULL,
  side TEXT CHECK (side IN ('BUY', 'SELL')) NOT NULL,
  quantity DECIMAL(15,6) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  trade_date DATE NOT NULL,
  close_date DATE,
  close_price DECIMAL(10,2),
  realized_pnl DECIMAL(15,2) DEFAULT 0,
  is_closed BOOLEAN DEFAULT FALSE,
  commissions DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create closed_stock_positions table
CREATE TABLE IF NOT EXISTS closed_stock_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  total_quantity DECIMAL(15,6) NOT NULL,
  total_cost_basis DECIMAL(15,2) NOT NULL,
  total_proceeds DECIMAL(15,2) NOT NULL,
  total_realized_pnl DECIMAL(15,2) NOT NULL,
  first_buy_date DATE NOT NULL,
  last_sell_date DATE NOT NULL,
  trade_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_stock_trades_position_id ON stock_trades(position_id);
CREATE INDEX IF NOT EXISTS idx_stock_trades_date ON stock_trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_closed_stock_positions_portfolio_id ON closed_stock_positions(portfolio_id);

-- Enable RLS
ALTER TABLE stock_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_stock_positions ENABLE ROW LEVEL SECURITY;

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('stock_trades', 'closed_stock_positions')
ORDER BY table_name; 