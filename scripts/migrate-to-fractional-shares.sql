-- Migration script to support fractional shares and options
-- Run this script to update your existing database schema

-- First, backup your data (recommended)
-- pg_dump your_database > backup_before_migration.sql

-- Update positions table to support fractional quantities
ALTER TABLE positions 
ALTER COLUMN quantity TYPE DECIMAL(15,6);

-- Update legs table to support fractional contracts
ALTER TABLE legs 
ALTER COLUMN contracts TYPE DECIMAL(15,6);

-- Add comments to document the changes
COMMENT ON COLUMN positions.quantity IS 'Quantity as DECIMAL(15,6) to support fractional shares';
COMMENT ON COLUMN legs.contracts IS 'Number of contracts as DECIMAL(15,6) to support fractional options';

-- Verify the changes
SELECT 
  table_name, 
  column_name, 
  data_type, 
  numeric_precision, 
  numeric_scale
FROM information_schema.columns 
WHERE table_name IN ('positions', 'legs') 
  AND column_name IN ('quantity', 'contracts')
ORDER BY table_name, column_name; 