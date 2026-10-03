#!/usr/bin/env bash
# ==============================================================================
# ENTERPRISES CRM — AWS EC2 PRODUCTION UPDATE & DEPLOY SCRIPT
# ==============================================================================
# Operation: Safe In-Place Application Update
# Steps:
#   1. Git pull latest code from branch (default: main)
#   2. Deterministic dependency installation with pnpm
#   3. Build frontend SPA artifacts & backend API
#   4. Execute safe, non-destructive database migrations
#   5. Restart systemd service
#   6. Verify health check
# ==============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/enterprises-crm}"
BRANCH="${1:-main}"

echo "============================================================"
echo "🚀  Enterprises CRM — Deploying Update (Branch: ${BRANCH})"
echo "============================================================"

cd "${APP_DIR}"

# 1. Pull latest changes
echo "[1/6] Fetching latest changes from Git..."
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull origin "${BRANCH}"

# 2. Install dependencies
echo "[2/6] Installing production dependencies with pnpm..."
pnpm install --frozen-lockfile

# 3. Production Build
echo "[3/6] Building production artifacts (@crm/web & @crm/api)..."
pnpm --filter @crm/web build
pnpm --filter @crm/api build

# 4. Safe Database Migrations
echo "[4/6] Applying non-destructive database migrations..."
pnpm db:migrate

# 5. Restart Application Service
echo "[5/6] Restarting systemd service (enterprises-crm)..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart enterprises-crm
fi

# 6. Verify Health
echo "[6/6] Verifying deployment health..."
sleep 3
if [ -f "${APP_DIR}/deploy/aws/health-check.sh" ]; then
  bash "${APP_DIR}/deploy/aws/health-check.sh"
else
  curl -fsS http://127.0.0.1:4000/health
fi

echo "============================================================"
echo "✅  Deployment Update Completed Successfully"
echo "============================================================"
exit 0
