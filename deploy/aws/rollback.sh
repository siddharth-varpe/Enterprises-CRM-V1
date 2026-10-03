#!/usr/bin/env bash
# ==============================================================================
# ENTERPRISES CRM — AWS EC2 PRODUCTION ROLLBACK SCRIPT
# ==============================================================================
# Operation: Fast Safe Rollback to Previous Known Good Commit/Tag
# Usage: ./rollback.sh [commit_hash | tag]
# ==============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/enterprises-crm}"
TARGET_REF="${1:-HEAD~1}"

echo "============================================================"
echo "⏪  Enterprises CRM — Rolling Back to: ${TARGET_REF}"
echo "============================================================"

cd "${APP_DIR}"

CURRENT_COMMIT="$(git rev-parse HEAD)"
echo "Current commit: ${CURRENT_COMMIT}"

# 1. Checkout target ref
echo "[1/5] Checking out target ref: ${TARGET_REF}..."
git checkout "${TARGET_REF}"
RESOLVED_COMMIT="$(git rev-parse HEAD)"
echo "Rolled back to commit: ${RESOLVED_COMMIT}"

# 2. Reinstall dependencies
echo "[2/5] Restoring dependencies for target commit..."
pnpm install --frozen-lockfile

# 3. Rebuild artifacts
echo "[3/5] Rebuilding application artifacts..."
pnpm --filter @crm/web build
pnpm --filter @crm/api build

# 4. Restart service
echo "[4/5] Restarting enterprises-crm service..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart enterprises-crm
fi

# 5. Verify health
echo "[5/5] Verifying health check..."
sleep 3
if [ -f "${APP_DIR}/deploy/aws/health-check.sh" ]; then
  bash "${APP_DIR}/deploy/aws/health-check.sh"
else
  curl -fsS http://127.0.0.1:4000/health
fi

echo "============================================================"
echo "✅  Rollback Completed Successfully to ${RESOLVED_COMMIT}"
echo "============================================================"
exit 0
