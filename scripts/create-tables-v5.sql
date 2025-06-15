-- Add share_cost_basis column to legs table
ALTER TABLE legs ADD COLUMN IF NOT EXISTS share_cost_basis DECIMAL(10,2);

-- Update existing records to set share_cost_basis to NULL
UPDATE legs SET share_cost_basis = NULL;

-- Add comment to explain the column
COMMENT ON COLUMN legs.share_cost_basis IS 'Cost basis per share for covered calls, only applicable for SELL CALL legs'; 