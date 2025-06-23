-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS closed_stock_positions CASCADE;
DROP TABLE IF EXISTS stock_trades CASCADE;
DROP TABLE IF EXISTS legs CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS portfolios CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('individual', 'advisor')) DEFAULT 'individual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create accounts table
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  broker_name TEXT,
  account_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create portfolios table
CREATE TABLE portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  cash DECIMAL(15,2) DEFAULT 0,
  total_equity DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create positions table with DECIMAL quantity to support fractional shares
CREATE TABLE positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  status TEXT CHECK (status IN ('PUT', 'STOCK', 'CALL')) NOT NULL,
  quantity DECIMAL(15,6) NOT NULL, -- Changed from INTEGER to DECIMAL to support fractional shares
  cost_basis DECIMAL(10,2),
  current_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stock_trades table to track individual stock buy/sell transactions (FIFO lots)
CREATE TABLE stock_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE NOT NULL,
  side TEXT CHECK (side IN ('BUY', 'SELL')) NOT NULL,
  quantity DECIMAL(15,6) NOT NULL, -- Supports fractional shares
  price DECIMAL(10,2) NOT NULL,
  trade_date DATE NOT NULL,
  close_date DATE, -- When this lot was closed (for SELL trades)
  close_price DECIMAL(10,2), -- Price at which this lot was closed
  realized_pnl DECIMAL(15,2) DEFAULT 0, -- Realized PnL for this lot
  is_closed BOOLEAN DEFAULT FALSE, -- Whether this lot has been fully closed
  commissions DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create legs table with DECIMAL contracts to support fractional options
CREATE TABLE legs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE NOT NULL,
  side TEXT CHECK (side IN ('SELL', 'BUY')) NOT NULL,
  type TEXT CHECK (type IN ('PUT', 'CALL')) NOT NULL,
  strike DECIMAL(10,2) NOT NULL,
  expiry DATE NOT NULL,
  open_date DATE NOT NULL,
  open_price DECIMAL(10,2) NOT NULL,
  close_date DATE,
  close_price DECIMAL(10,2),
  close_type TEXT CHECK (close_type IN ('BTC', 'EXPIRED', 'ASSIGNED', 'EXERCISED')) NULL,
  realized_pnl DECIMAL(15,2) DEFAULT 0,
  contracts DECIMAL(15,6) NOT NULL, -- Changed from INTEGER to DECIMAL to support fractional contracts
  commissions DECIMAL(10,2) DEFAULT 0,
  is_assigned BOOLEAN DEFAULT FALSE,
  is_exercised BOOLEAN DEFAULT FALSE,
  share_cost_basis DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create closed_stock_positions table to display closed stock positions with PnL
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

-- Create indexes for better performance
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_portfolios_account_id ON portfolios(account_id);
CREATE INDEX idx_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_stock_trades_position_id ON stock_trades(position_id);
CREATE INDEX idx_stock_trades_date ON stock_trades(trade_date);
CREATE INDEX idx_stock_trades_is_closed ON stock_trades(is_closed);
CREATE INDEX idx_legs_position_id ON legs(position_id);
CREATE INDEX idx_legs_expiry ON legs(expiry);
CREATE INDEX idx_closed_stock_positions_portfolio_id ON closed_stock_positions(portfolio_id);
CREATE INDEX idx_closed_stock_positions_symbol ON closed_stock_positions(symbol);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_stock_positions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for accounts
CREATE POLICY "Users can view own accounts" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for portfolios
CREATE POLICY "Users can view own portfolios" ON portfolios FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM accounts WHERE id = account_id)
);
CREATE POLICY "Users can insert own portfolios" ON portfolios FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT user_id FROM accounts WHERE id = account_id)
);
CREATE POLICY "Users can update own portfolios" ON portfolios FOR UPDATE USING (
  auth.uid() IN (SELECT user_id FROM accounts WHERE id = account_id)
);
CREATE POLICY "Users can delete own portfolios" ON portfolios FOR DELETE USING (
  auth.uid() IN (SELECT user_id FROM accounts WHERE id = account_id)
);

-- Create RLS policies for positions
CREATE POLICY "Users can view own positions" ON positions FOR SELECT USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);
CREATE POLICY "Users can insert own positions" ON positions FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);
CREATE POLICY "Users can update own positions" ON positions FOR UPDATE USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);
CREATE POLICY "Users can delete own positions" ON positions FOR DELETE USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    WHERE p.id = portfolio_id
  )
);

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

-- Create RLS policies for legs
CREATE POLICY "Users can view own legs" ON legs FOR SELECT USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    JOIN positions pos ON pos.portfolio_id = p.id
    WHERE pos.id = position_id
  )
);
CREATE POLICY "Users can insert own legs" ON legs FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    JOIN positions pos ON pos.portfolio_id = p.id
    WHERE pos.id = position_id
  )
);
CREATE POLICY "Users can update own legs" ON legs FOR UPDATE USING (
  auth.uid() IN (
    SELECT a.user_id FROM accounts a 
    JOIN portfolios p ON p.account_id = a.id 
    JOIN positions pos ON pos.portfolio_id = p.id
    WHERE pos.id = position_id
  )
);
CREATE POLICY "Users can delete own legs" ON legs FOR DELETE USING (
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

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  account_id UUID;
  portfolio_id UUID;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  
  -- Create default account
  INSERT INTO public.accounts (user_id, name)
  VALUES (NEW.id, 'Default Account')
  RETURNING id INTO account_id;
  
  -- Create default portfolio
  INSERT INTO public.portfolios (account_id, name)
  VALUES (account_id, 'Default Portfolio')
  RETURNING id INTO portfolio_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to handle updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON stock_trades FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON legs FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON closed_stock_positions FOR EACH ROW EXECUTE FUNCTION handle_updated_at(); 