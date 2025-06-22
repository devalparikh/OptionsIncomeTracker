# Fractional Shares Support Migration

This document explains the changes made to support fractional shares and options in the Options Income Tracker.

## What Changed

The database schema has been updated to support fractional quantities:

1. **Positions table**: `quantity` field changed from `INTEGER` to `DECIMAL(15,6)`
2. **Legs table**: `contracts` field changed from `INTEGER` to `DECIMAL(15,6)`

This allows the system to handle:

- Fractional stock shares (e.g., 0.5 shares of AAPL)
- Fractional option contracts (e.g., 0.1 contracts)
- Precise quantity tracking without rounding

## Migration Steps

### Option 1: Fresh Database (Recommended for new installations)

If you're setting up a new database, use the complete schema:

```bash
psql -d your_database -f scripts/create-tables-v5.sql
```

### Option 2: Migrate Existing Database

If you have existing data, run the migration script:

```bash
# First, backup your database
pg_dump your_database > backup_before_migration.sql

# Run the migration
psql -d your_database -f scripts/migrate-to-fractional-shares.sql
```

## API Changes

The `/api/upload/robinhood` endpoint now:

- Accepts fractional quantities without rounding
- Stores exact decimal values in the database
- No longer shows warnings about fractional quantities being rounded

## Testing

You can test the fractional shares support with the provided test CSV:

```bash
# Test the API with fractional shares
node test-robinhood-upload.js
```

The test file includes examples of:

- 0.5 shares of stock
- 0.1 option contracts
- Various fractional quantities

## Benefits

1. **Accuracy**: No more rounding errors or lost precision
2. **Flexibility**: Supports modern trading platforms that allow fractional shares
3. **Compatibility**: Works with Robinhood and other brokers that support fractional trading
4. **Future-proof**: Ready for any fractional trading requirements

## Rollback

If you need to rollback, you can restore from your backup:

```bash
psql -d your_database -f backup_before_migration.sql
```

## Verification

After migration, verify the changes:

```sql
SELECT
  table_name,
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name IN ('positions', 'legs')
  AND column_name IN ('quantity', 'contracts');
```

You should see `DECIMAL` with precision 15 and scale 6 for both fields.
