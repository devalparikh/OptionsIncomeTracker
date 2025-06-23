-- Create stock_trade_pairs table to store buy/sell relationships
CREATE TABLE IF NOT EXISTS stock_trade_pairs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  buy_trade_id UUID REFERENCES stock_trades(id) ON DELETE CASCADE NOT NULL,
  sell_trade_id UUID REFERENCES stock_trades(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(15,6) NOT NULL, -- Quantity of shares in this pair
  bought_price DECIMAL(10,2) NOT NULL, -- Price per share when bought
  sold_price DECIMAL(10,2) NOT NULL, -- Price per share when sold
  bought_date DATE NOT NULL, -- Date when shares were bought
  sold_date DATE NOT NULL, -- Date when shares were sold
  realized_pnl DECIMAL(15,2) NOT NULL, -- Realized PnL for this pair
  total_proceeds DECIMAL(15,2) NOT NULL, -- Total proceeds from sale
  total_cost DECIMAL(15,2) NOT NULL, -- Total cost of shares
  commissions DECIMAL(10,2) DEFAULT 0, -- Total commissions for this pair
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_trade_pairs_portfolio_id ON stock_trade_pairs(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_stock_trade_pairs_symbol ON stock_trade_pairs(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_trade_pairs_sold_date ON stock_trade_pairs(sold_date);
CREATE INDEX IF NOT EXISTS idx_stock_trade_pairs_buy_trade_id ON stock_trade_pairs(buy_trade_id);
CREATE INDEX IF NOT EXISTS idx_stock_trade_pairs_sell_trade_id ON stock_trade_pairs(sell_trade_id);

-- Enable Row Level Security
ALTER TABLE stock_trade_pairs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for stock_trade_pairs
CREATE POLICY "Users can view own stock_trade_pairs" ON stock_trade_pairs FOR SELECT USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);

CREATE POLICY "Users can insert own stock_trade_pairs" ON stock_trade_pairs FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);

CREATE POLICY "Users can update own stock_trade_pairs" ON stock_trade_pairs FOR UPDATE USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);

CREATE POLICY "Users can delete own stock_trade_pairs" ON stock_trade_pairs FOR DELETE USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON stock_trade_pairs 
FOR EACH ROW EXECUTE FUNCTION handle_updated_at(); 