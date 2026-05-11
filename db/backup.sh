#!/bin/bash
# ============================================================
# Ordering Database - Daily Backup Script
# ============================================================
# Saves a compressed SQL dump with timestamp to backup dir.
# Keeps backups for 14 days.
# ============================================================

set -euo pipefail

# Configuration
BACKUP_DIR="/home/ubuntu/Ordering/db/backups"
DB_NAME="ordering_db"
DB_USER="ordering_user"
DB_HOST="localhost"
DB_PORT="5432"
RETENTION_DAYS=14

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# Perform backup
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup: ${FILENAME}"
PGPASSWORD="OrderingDB2026!Secure" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    --compress=9 \
    -f "$FILEPATH"

# Check backup size
BACKUP_SIZE=$(du -h "$FILEPATH" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete: ${FILENAME} (${BACKUP_SIZE})"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# Log backup info to a manifest
echo "${TIMESTAMP}|${FILENAME}|${BACKUP_SIZE}" >> "${BACKUP_DIR}/backup_manifest.txt"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Old backups cleaned (retention: ${RETENTION_DAYS} days)"
