-- Migration script to add close_type and realized_pnl fields to legs table
-- Run this script to update your existing database schema

-- First, backup your data (recommended)
-- pg_dump your_database > backup_before_close_type_pnl_migration.sql

-- Add close_type column to legs table
ALTER TABLE legs 
ADD COLUMN IF NOT EXISTS close_type TEXT CHECK (close_type IN ('BTC', 'EXPIRED', 'ASSIGNED', 'EXERCISED'));

-- Add realized_pnl column to legs table
ALTER TABLE legs 
ADD COLUMN IF NOT EXISTS realized_pnl DECIMAL(15,2) DEFAULT 0;

-- Add comments to document the new fields
COMMENT ON COLUMN legs.close_type IS 'How the leg was closed: BTC (Buy to Close), EXPIRED, ASSIGNED, or EXERCISED';
COMMENT ON COLUMN legs.realized_pnl IS 'Realized profit/loss for this leg in dollars';

-- Update existing closed legs to set close_type based on existing flags
UPDATE legs 
SET close_type = CASE 
  WHEN is_assigned = true THEN 'ASSIGNED'
  WHEN is_exercised = true THEN 'EXERCISED'
  WHEN close_date IS NOT NULL AND close_price IS NOT NULL AND close_price > 0 THEN 'BTC'
  WHEN close_date IS NOT NULL AND (close_price IS NULL OR close_price = 0) THEN 'EXPIRED'
  ELSE NULL
END
WHERE close_date IS NOT NULL;

-- Calculate realized PnL for existing closed legs
UPDATE legs 
SET realized_pnl = CASE 
  WHEN side = 'SELL' AND (close_price IS NULL OR close_price = 0) THEN 
    -- Expired worthless options: keep full premium minus commissions
    (open_price * 100 * contracts) - commissions
  WHEN side = 'BUY' AND (close_price IS NULL OR close_price = 0) THEN 
    -- Long options that expired worthless: lose premium paid plus commissions
    -(open_price * 100 * contracts) - commissions
  WHEN side = 'SELL' THEN 
    -- BTC or Assignment: premium received minus close cost minus commissions
    (open_price * 100 * contracts) - (COALESCE(close_price, 0) * 100 * contracts) - commissions
  WHEN side = 'BUY' THEN 
    -- Long options closed: close proceeds minus premium paid minus commissions
    (COALESCE(close_price, 0) * 100 * contracts) - (open_price * 100 * contracts) - commissions
  ELSE 0
END
WHERE close_date IS NOT NULL;

-- Verify the changes
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'legs' 
  AND column_name IN ('close_type', 'realized_pnl')
ORDER BY column_name;

-- Show sample of updated data (with proper join to get symbol)
SELECT 
  l.id,
  p.symbol,
  l.side,
  l.type,
  l.close_date,
  l.close_type,
  l.realized_pnl,
  l.open_price,
  l.close_price,
  l.contracts,
  l.commissions
FROM legs l
JOIN positions p ON l.position_id = p.id
WHERE l.close_date IS NOT NULL 
LIMIT 10; 