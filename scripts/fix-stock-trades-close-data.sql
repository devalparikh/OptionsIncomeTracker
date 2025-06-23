-- Fix existing SELL trades that have redundant close_date and close_price
-- Since we're now handling buy/sell relationships properly in the API,
-- we should remove the redundant close_date and close_price from SELL trades

UPDATE stock_trades 
SET 
  close_date = NULL,
  close_price = NULL
WHERE 
  side = 'SELL' 
  AND close_date = trade_date 
  AND close_price = price;

-- Verify the fix
SELECT 
  side,
  COUNT(*) as total_trades,
  COUNT(close_date) as trades_with_close_date,
  COUNT(close_price) as trades_with_close_price
FROM stock_trades 
GROUP BY side; 