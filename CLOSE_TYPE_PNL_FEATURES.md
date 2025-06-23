# Close Type and Realized PnL Features

This document explains the new features added to track how option legs are closed and their realized profit/loss, matching the functionality of the C# implementation.

## New Database Fields

### Legs Table Additions

1. **`close_type`** - TEXT field with values:

   - `'BTC'` - Buy to Close (leg was closed by buying back)
   - `'EXPIRED'` - Option expired worthless
   - `'ASSIGNED'` - Option was assigned (put seller had to buy shares)
   - `'EXERCISED'` - Option was exercised (call buyer exercised to buy shares)

2. **`realized_pnl`** - DECIMAL(15,2) field storing the realized profit/loss in dollars

## How It Works

### Option Leg Closing

When an option leg is closed, the system now:

1. **Determines Close Type** based on the trade activity:

   ```typescript
   if (trade.type === ActivityType.BTC) {
     closeType = "BTC";
   } else if (trade.type === ActivityType.Expired) {
     closeType = "EXPIRED";
   } else if (trade.type === ActivityType.Assignment) {
     closeType = "ASSIGNED";
   }
   ```

2. **Calculates Realized PnL** using the formula:
   ```typescript
   const openPremium = leg.open_price * 100 * leg.contracts;
   const closeCost = (trade.price || 0) * 100 * leg.contracts;
   const realizedPnL =
     leg.side === "SELL"
       ? openPremium - closeCost - commissions
       : closeCost - openPremium - commissions;
   ```

### Stock Position PnL

For stock trades, realized PnL is calculated but not stored in the database (since positions table doesn't have a realized_pnl field):

```typescript
const realizedPnL = (salePrice - costBasis) * soldQuantity;
```

## Migration

### For New Installations

Use the updated schema:

```bash
psql -d your_database -f scripts/create-tables-v5.sql
```

### For Existing Installations

Run the migration script:

```bash
# Backup first
pg_dump your_database > backup_before_close_type_pnl_migration.sql

# Run migration
psql -d your_database -f scripts/migrate-to-close-type-pnl.sql
```

The migration script will:

1. Add the new columns
2. Update existing closed legs with appropriate close_type values
3. Calculate realized_pnl for existing closed legs

## API Changes

The `/api/upload/robinhood` endpoint now:

1. **Tracks Close Types**: Automatically determines and stores how each leg was closed
2. **Calculates PnL**: Computes realized profit/loss for each closed leg
3. **Handles Commissions**: Includes commission costs in PnL calculations
4. **Supports Fractional**: Works with fractional shares and contracts

## Example Data

After processing a Robinhood CSV, you might see:

```sql
SELECT
  symbol,
  side,
  type,
  close_date,
  close_type,
  realized_pnl,
  open_price,
  close_price,
  contracts
FROM legs
WHERE close_date IS NOT NULL;
```

Results:

```
symbol | side | type | close_date  | close_type | realized_pnl | open_price | close_price | contracts
-------|------|------|-------------|------------|--------------|------------|-------------|----------
AAPL   | SELL | PUT  | 2024-01-15  | BTC        | 125.50       | 2.50       | 1.25        | 1.0
TSLA   | SELL | CALL | 2024-01-20  | EXPIRED    | 300.00       | 3.00       | NULL        | 1.0
NVDA   | SELL | PUT  | 2024-01-25  | ASSIGNED   | 150.00       | 1.50       | NULL        | 1.0
```

## Benefits

1. **Accurate Tracking**: Know exactly how each position was closed
2. **PnL Analysis**: Calculate realized profits/losses for performance analysis
3. **C# Compatibility**: Matches the functionality of the original C# implementation
4. **Audit Trail**: Complete history of how positions were managed
5. **Reporting**: Enable detailed performance reports and analysis

## Usage in Frontend

The new fields can be used in the UI to:

- Show close type badges (BTC, Expired, Assigned)
- Display realized PnL in position summaries
- Filter positions by close type
- Generate performance reports
- Calculate portfolio-level realized PnL

## Testing

Test the new features with the provided test CSV:

```bash
node test-robinhood-upload.js
```

The test includes various close types to verify the functionality works correctly.
