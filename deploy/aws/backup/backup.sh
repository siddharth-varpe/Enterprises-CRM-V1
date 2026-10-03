#!/usr/bin/env bash
# ==============================================================================
# ENTERPRISES CRM — AWS EC2 DATABASE BACKUP SCRIPT
# ==============================================================================
# Operation: Automated Logical PostgreSQL Backup
# Reliability:
#   1. Atomic writing to temporary file before final rename
#   2. Gzip decompression verification (gzip -t)
#   3. SHA-256 checksum calculation
#   4. Retention cleanup (default 14 days) ONLY runs after verification passes
# ==============================================================================

set -euo pipefail

# Configuration
ENV_FILE="${ENV_FILE:-/etc/enterprises-crm.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/enterprises-crm}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"

# Load environment if present
if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  set -a
  source "${ENV_FILE}"
  set +a
fi

# Determine database connection parameters
# Prefer DATABASE_URL if available, else standard fallback
DB_NAME="${POSTGRES_DB:-enterprises_crm}"
DB_USER="${POSTGRES_USER:-crm_user}"
DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/enterprises_crm_backup_${TIMESTAMP}.sql.gz"
TEMP_BACKUP_FILE="${BACKUP_FILE}.tmp"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

echo "============================================================"
echo "🛡️  Enterprises CRM — Initiating Database Backup"
echo "============================================================"
echo "Timestamp:    ${TIMESTAMP}"
echo "Destination:  ${BACKUP_FILE}"

# Execute pg_dump
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[1/4] Dumping database using DATABASE_URL..."
  pg_dump "${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges | gzip -9 > "${TEMP_BACKUP_FILE}"
else
  echo "[1/4] Dumping database ${DB_NAME} at ${DB_HOST}:${DB_PORT}..."
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" --clean --if-exists --no-owner --no-privileges | gzip -9 > "${TEMP_BACKUP_FILE}"
fi

# Verify gzip integrity
echo "[2/4] Verifying gzip archive integrity..."
if ! gzip -t "${TEMP_BACKUP_FILE}"; then
  echo "❌ CRITICAL ERROR: Backup file failed gzip integrity check!"
  rm -f "${TEMP_BACKUP_FILE}"
  exit 1
fi

# Move temporary file to final location
mv "${TEMP_BACKUP_FILE}" "${BACKUP_FILE}"
chmod 600 "${BACKUP_FILE}"

# Generate SHA-256 checksum
echo "[3/4] Generating SHA-256 checksum..."
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
chmod 600 "${CHECKSUM_FILE}"

FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "✅ Backup successfully verified. Size: ${FILE_SIZE}"

# Prune old backups only after current backup is verified
echo "[4/4] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "enterprises_crm_backup_*.sql.gz*" -mtime "+${RETENTION_DAYS}" -exec rm -f {} +

echo "============================================================"
echo "🛡️  Database Backup Completed Successfully"
echo "============================================================"
exit 0
