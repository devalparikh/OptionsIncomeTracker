# Restoring Your Supabase Database

This guide explains how to restore your Supabase database from a backup file.

## Prerequisites

1. **PostgreSQL client tools installed:**
   - On macOS: `brew install postgresql` or `brew install libpq`
   - On Linux: `sudo apt-get install postgresql-client` (Debian/Ubuntu) or `sudo yum install postgresql` (RHEL/CentOS)
   - On Windows: Download from [PostgreSQL downloads](https://www.postgresql.org/download/windows/)

2. **Your backup file** (SQL dump or custom format)

3. **Your Supabase connection URL** - You can find this in your Supabase dashboard:
   - Go to Project Settings → Database
   - Look for "Connection string" or "Connection pooling"
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

## Method 1: Using the Bash Script (Recommended)

```bash
./scripts/restore-database.sh <backup-file> <connection-url>
```

**Example:**
```bash
./scripts/restore-database.sh backup.sql 'postgresql://postgres:mypassword@db.abcdefghijklmnop.supabase.co:5432/postgres'
```

**Or with environment variables:**
```bash
BACKUP_FILE=backup.sql CONNECTION_URL='postgresql://...' ./scripts/restore-database.sh
```

## Method 2: Using the Node.js Script

```bash
node scripts/restore-database.js <backup-file> <connection-url>
```

**Example:**
```bash
node scripts/restore-database.js backup.sql 'postgresql://postgres:mypassword@db.abcdefghijklmnop.supabase.co:5432/postgres'
```

## Method 3: Manual Restore

### For SQL format backups (.sql files):

```bash
psql 'postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres' -f backup.sql
```

### For custom format backups (.tar, .custom files):

```bash
pg_restore -d 'postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres' --clean --if-exists backup.tar
```

## Getting Your Connection URL

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **Database**
4. Under **Connection string**, select **URI** tab
5. Copy the connection string (it will look like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`)
6. Replace `[YOUR-PASSWORD]` with your actual database password

## Important Notes

⚠️ **Warning:** Restoring a database will **overwrite** existing data. Make sure you have a backup of your current database before restoring.

⚠️ The `--clean --if-exists` flags will drop existing objects before restoring. If you want to preserve some data, you may need to modify the restore command.

## Troubleshooting

### "psql: command not found"
- Install PostgreSQL client tools (see Prerequisites)

### "password authentication failed"
- Double-check your password in the connection URL
- Ensure you're using the correct database password (not your Supabase account password)

### "connection refused" or "could not connect"
- Verify your connection URL is correct
- Check that your Supabase project is active
- Ensure you're not behind a firewall blocking the connection

### "permission denied"
- Make sure the backup file is readable
- Ensure you have execute permissions on the script: `chmod +x scripts/restore-database.sh`

## Backup File Formats

The scripts automatically detect the backup format:
- **.sql** or **.dump** → Uses `psql` for SQL format
- **.tar** or **.custom** → Uses `pg_restore` for custom format
- **Other** → Attempts SQL format

## Example Workflow

```bash
# 1. Navigate to project directory
cd /path/to/OptionsIncomeTracker

# 2. Restore using bash script
./scripts/restore-database.sh ~/Downloads/supabase-backup-2024-01-15.sql \
  'postgresql://postgres:mypassword@db.abcdefghijklmnop.supabase.co:5432/postgres'

# 3. Verify the restore worked by checking your app
```
