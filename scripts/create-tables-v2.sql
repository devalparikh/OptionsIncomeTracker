-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS legs CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS portfolios CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

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

-- Create positions table
CREATE TABLE positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  status TEXT CHECK (status IN ('PUT', 'STOCK', 'CALL')) NOT NULL,
  quantity INTEGER NOT NULL,
  cost_basis DECIMAL(10,2),
  current_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create legs table with proper foreign key
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
  contracts INTEGER NOT NULL,
  commissions DECIMAL(10,2) DEFAULT 0,
  is_assigned BOOLEAN DEFAULT FALSE,
  is_exercised BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_portfolios_account_id ON portfolios(account_id);
CREATE INDEX idx_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_legs_position_id ON legs(position_id);
CREATE INDEX idx_legs_expiry ON legs(expiry);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;

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

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  account_id UUID;
  portfolio_id UUID;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  -- Create default account
  INSERT INTO public.accounts (user_id, name)
  VALUES (NEW.id, 'Default Account')
  RETURNING id INTO account_id;
  
  -- Create default portfolio
  INSERT INTO public.portfolios (account_id, name)
  VALUES (account_id, 'Main Portfolio');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS handle_updated_at ON profiles;
DROP TRIGGER IF EXISTS handle_updated_at ON accounts;
DROP TRIGGER IF EXISTS handle_updated_at ON portfolios;
DROP TRIGGER IF EXISTS handle_updated_at ON positions;
DROP TRIGGER IF EXISTS handle_updated_at ON legs;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON legs FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
