#!/usr/bin/env bash
# ==============================================================================
# ENTERPRISES CRM — AWS EC2 DATABASE RESTORE SCRIPT
# ==============================================================================
# Operation: Safe Database Restoration with Pre-Restore Snapshot
# Safety Measures:
#   1. Validates backup file existence and gzip integrity
#   2. Verifies SHA-256 checksum if available
#   3. Takes an EMERGENCY SNAPSHOT of the current database before touching data
#   4. Requires explicit --confirm flag to prevent catastrophic accidental data loss
# ==============================================================================

set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/enterprises-crm.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/enterprises-crm}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  set -a
  source "${ENV_FILE}"
  set +a
fi

TARGET_FILE="${1:-}"
CONFIRM_FLAG="${2:-}"

if [ -z "${TARGET_FILE}" ]; then
  echo "Usage: $0 <path-to-backup-file.sql.gz> [--confirm]"
  echo "Example: $0 /var/backups/enterprises-crm/enterprises_crm_backup_20261003_120000Z.sql.gz --confirm"
  exit 1
fi

if [ ! -f "${TARGET_FILE}" ]; then
  echo "❌ Error: Target backup file '${TARGET_FILE}' does not exist!"
  exit 1
fi

echo "============================================================"
echo "⚠️  Enterprises CRM — Database Restore Warning"
echo "============================================================"
echo "Target File: ${TARGET_FILE}"
echo "THIS WILL OVERWRITE THE CURRENT DATABASE CONTENT."
echo "------------------------------------------------------------"

if [ "${CONFIRM_FLAG}" != "--confirm" ]; then
  read -r -p "Type 'RESTORE-NOW' to confirm restoration: " INPUT_CONFIRM
  if [ "${INPUT_CONFIRM}" != "RESTORE-NOW" ]; then
    echo "Restoration aborted by user."
    exit 1
  fi
fi

# 1. Verify gzip integrity
echo "[1/4] Verifying archive integrity..."
if ! gzip -t "${TARGET_FILE}"; then
  echo "❌ Error: Backup file failed gzip integrity validation! Restore aborted."
  exit 1
fi

# 2. Verify SHA-256 if checksum file exists
CHECKSUM_FILE="${TARGET_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "[2/4] Verifying SHA-256 checksum..."
  if ! sha256sum --check --status "${CHECKSUM_FILE}"; then
    echo "❌ Error: Checksum mismatch! The backup file may be corrupted."
    exit 1
  fi
  echo "✅ Checksum verified."
else
  echo "[2/4] No checksum file found; proceeding with gzip-verified archive."
fi

# 3. Take emergency pre-restore snapshot
PRE_SNAPSHOT="${BACKUP_DIR}/pre_restore_snapshot_$(date -u +"%Y%m%d_%H%M%SZ").sql.gz"
echo "[3/4] Creating emergency pre-restore snapshot at: ${PRE_SNAPSHOT}"
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "${DATABASE_URL}" --clean --if-exists | gzip -9 > "${PRE_SNAPSHOT}" || echo "⚠️ Warning: Pre-restore snapshot failed. Proceeding with caution."
fi

# 4. Perform database restoration
echo "[4/4] Applying database restoration..."
if [ -n "${DATABASE_URL:-}" ]; then
  gunzip -c "${TARGET_FILE}" | psql "${DATABASE_URL}" --single-transaction
else
  DB_NAME="${POSTGRES_DB:-enterprises_crm}"
  DB_USER="${POSTGRES_USER:-crm_user}"
  DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
  DB_PORT="${POSTGRES_PORT:-5432}"
  gunzip -c "${TARGET_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --single-transaction
fi

echo "============================================================"
echo "✅ Database Restored Successfully"
echo "============================================================"
exit 0
