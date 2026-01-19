#!/usr/bin/env node

/**
 * Supabase Database Restore Script (Node.js version)
 * 
 * Usage: 
 *   node restore-database.js <backup-file> <connection-url>
 * 
 * Example:
 *   node restore-database.js backup.sql 'postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres'
 * 
 * Or use environment variables:
 *   BACKUP_FILE=backup.sql CONNECTION_URL='...' node restore-database.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_FILE = process.argv[2] || process.env.BACKUP_FILE;
const CONNECTION_URL = process.argv[3] || process.env.CONNECTION_URL;

if (!BACKUP_FILE || !CONNECTION_URL) {
  console.error('Usage: node restore-database.js <backup-file> <connection-url>');
  console.error('');
  console.error('Example:');
  console.error('  node restore-database.js backup.sql \'postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres\'');
  console.error('');
  console.error('Or use environment variables:');
  console.error('  BACKUP_FILE=backup.sql CONNECTION_URL=\'...\' node restore-database.js');
  process.exit(1);
}

if (!fs.existsSync(BACKUP_FILE)) {
  console.error(`Error: Backup file '${BACKUP_FILE}' not found`);
  process.exit(1);
}

// Extract password from connection URL for PGPASSWORD
const passwordMatch = CONNECTION_URL.match(/:\/\/([^:]+):([^@]+)@/);
const PGPASSWORD = passwordMatch ? passwordMatch[2] : '';

// Mask connection URL for display
const maskedUrl = CONNECTION_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');

console.log(`Restoring database from: ${BACKUP_FILE}`);
console.log(`Connection: ${maskedUrl}`);

try {
  // Detect backup file format
  const ext = path.extname(BACKUP_FILE).toLowerCase();
  
  if (ext === '.sql' || ext === '.dump') {
    // SQL format - use psql
    console.log('Detected SQL format, using psql...');
    const env = { ...process.env, PGPASSWORD };
    execSync(`psql "${CONNECTION_URL}" -f "${BACKUP_FILE}"`, {
      stdio: 'inherit',
      env
    });
  } else if (ext === '.tar' || ext === '.custom') {
    // Custom format - use pg_restore
    console.log('Detected custom format, using pg_restore...');
    const env = { ...process.env, PGPASSWORD };
    execSync(`pg_restore -d "${CONNECTION_URL}" --clean --if-exists "${BACKUP_FILE}"`, {
      stdio: 'inherit',
      env
    });
  } else {
    // Try SQL format first
    console.log('Unknown format, trying SQL format...');
    const env = { ...process.env, PGPASSWORD };
    execSync(`psql "${CONNECTION_URL}" -f "${BACKUP_FILE}"`, {
      stdio: 'inherit',
      env
    });
  }
  
  console.log('Restore completed successfully!');
} catch (error) {
  console.error('Error during restore:', error.message);
  process.exit(1);
}
