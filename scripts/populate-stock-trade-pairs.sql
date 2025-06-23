-- Populate stock_trade_pairs table with existing buy/sell relationships
-- This script processes existing stock_trades to create trade pairs

-- First, let's see what we have
SELECT 
  side,
  COUNT(*) as total_trades,
  COUNT(CASE WHEN is_closed = true THEN 1 END) as closed_trades,
  COUNT(CASE WHEN close_date IS NOT NULL THEN 1 END) as trades_with_close_date
FROM stock_trades 
GROUP BY side;

-- Insert trade pairs for existing closed buy trades
INSERT INTO stock_trade_pairs (
  portfolio_id,
  symbol,
  buy_trade_id,
  sell_trade_id,
  quantity,
  bought_price,
  sold_price,
  bought_date,
  sold_date,
  realized_pnl,
  total_proceeds,
  total_cost,
  commissions
)
SELECT 
  p.portfolio_id,
  p.symbol,
  buy_trade.id as buy_trade_id,
  sell_trade.id as sell_trade_id,
  buy_trade.quantity,
  buy_trade.price as bought_price,
  sell_trade.price as sold_price,
  buy_trade.trade_date as bought_date,
  sell_trade.trade_date as sold_date,
  buy_trade.realized_pnl,
  (sell_trade.price * buy_trade.quantity) as total_proceeds,
  (buy_trade.price * buy_trade.quantity) as total_cost,
  COALESCE(buy_trade.commissions, 0) + COALESCE(sell_trade.commissions, 0) as commissions
FROM stock_trades buy_trade
JOIN positions p ON p.id = buy_trade.position_id
JOIN stock_trades sell_trade ON 
  sell_trade.position_id = buy_trade.position_id AND
  sell_trade.side = 'SELL' AND
  sell_trade.trade_date = buy_trade.close_date AND
  sell_trade.price = buy_trade.close_price
WHERE 
  buy_trade.side = 'BUY' AND
  buy_trade.is_closed = true AND
  buy_trade.close_date IS NOT NULL AND
  buy_trade.close_price IS NOT NULL
  AND NOT EXISTS (
    -- Avoid duplicates
    SELECT 1 FROM stock_trade_pairs stp 
    WHERE stp.buy_trade_id = buy_trade.id AND stp.sell_trade_id = sell_trade.id
  );

-- Verify the results
SELECT 
  COUNT(*) as total_pairs,
  COUNT(DISTINCT symbol) as unique_symbols,
  SUM(realized_pnl) as total_realized_pnl,
  SUM(total_proceeds) as total_proceeds
FROM stock_trade_pairs; 