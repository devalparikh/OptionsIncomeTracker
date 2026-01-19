#!/bin/bash

# Supabase Database Restore Script
# Usage: ./restore-database.sh <backup-file> <connection-url>
# Example: ./restore-database.sh backup.sql "postgresql://postgres:[password]@[host]:5432/postgres"

set -e

BACKUP_FILE="${1}"
CONNECTION_URL="${2}"

if [ -z "$BACKUP_FILE" ] || [ -z "$CONNECTION_URL" ]; then
    echo "Usage: $0 <backup-file> <connection-url>"
    echo ""
    echo "Example:"
    echo "  $0 backup.sql 'postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres'"
    echo ""
    echo "Or use environment variables:"
    echo "  BACKUP_FILE=backup.sql CONNECTION_URL='...' $0"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file '$BACKUP_FILE' not found"
    exit 1
fi

echo "Restoring database from: $BACKUP_FILE"
echo "Connection: ${CONNECTION_URL%%:*}" # Show only protocol, not full credentials

# Detect backup file format
if [[ "$BACKUP_FILE" == *.sql ]] || [[ "$BACKUP_FILE" == *.dump ]]; then
    # SQL format - use psql
    echo "Detected SQL format, using psql..."
    PGPASSWORD=$(echo "$CONNECTION_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
    psql "$CONNECTION_URL" -f "$BACKUP_FILE"
elif [[ "$BACKUP_FILE" == *.tar ]] || [[ "$BACKUP_FILE" == *.custom ]]; then
    # Custom format - use pg_restore
    echo "Detected custom format, using pg_restore..."
    PGPASSWORD=$(echo "$CONNECTION_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
    pg_restore -d "$CONNECTION_URL" --clean --if-exists "$BACKUP_FILE"
else
    # Try SQL format first
    echo "Unknown format, trying SQL format..."
    PGPASSWORD=$(echo "$CONNECTION_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
    psql "$CONNECTION_URL" -f "$BACKUP_FILE"
fi

echo "Restore completed successfully!"
