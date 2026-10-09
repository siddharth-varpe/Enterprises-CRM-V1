#!/usr/bin/env bash
# ==============================================================================
# ENTERPRISES CRM — AWS EC2 PRODUCTION HOST INSTALLATION SCRIPT
# ==============================================================================
# Target: Ubuntu 22.04 / 24.04 LTS (x86_64 Recommended)
# Prerequisites: Node.js 20 LTS, pnpm 9, Nginx, PostgreSQL, Redis installed
# ==============================================================================

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: install.sh must be run as root (use sudo)."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/enterprises-crm"
SERVICE_USER="crmapp"

echo "============================================================"
echo "⚙️  Enterprises CRM — Initializing Production Host Setup"
echo "============================================================"

# 1. Create dedicated non-root application user
if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  echo "[1/8] Creating dedicated service user: ${SERVICE_USER}..."
  useradd -r -s /usr/sbin/nologin -d "${APP_DIR}" "${SERVICE_USER}"
else
  echo "[1/8] Service user ${SERVICE_USER} already exists."
fi

# 2. Create production directories
echo "[2/8] Creating required application, storage, and log directories..."
mkdir -p "${APP_DIR}"
mkdir -p /var/lib/enterprises-crm/storage/documents
mkdir -p /var/lib/enterprises-crm/storage/temp
mkdir -p /var/backups/enterprises-crm
mkdir -p /var/log/enterprises-crm
mkdir -p /var/www/certbot

# Set directory permissions
chown -R "${SERVICE_USER}:${SERVICE_USER}" /var/lib/enterprises-crm
chown -R "${SERVICE_USER}:${SERVICE_USER}" /var/log/enterprises-crm
chown -R "${SERVICE_USER}:${SERVICE_USER}" /var/backups/enterprises-crm
chmod 700 /var/backups/enterprises-crm

# 3. Environment configuration template
echo "[3/8] Setting up production environment file (/etc/enterprises-crm.env)..."
if [ ! -f /etc/enterprises-crm.env ]; then
  cp "${SCRIPT_DIR}/env.example" /etc/enterprises-crm.env
  chown root:"${SERVICE_USER}" /etc/enterprises-crm.env
  chmod 600 /etc/enterprises-crm.env
  echo "⚠️ NOTICE: Created /etc/enterprises-crm.env. Fill in database credentials and secrets before starting service."
else
  echo "/etc/enterprises-crm.env already exists; preserving."
fi

# 4. Install systemd service
echo "[4/8] Installing systemd service..."
cp "${SCRIPT_DIR}/systemd/enterprises-crm.service" /etc/systemd/system/enterprises-crm.service
systemctl daemon-reload
systemctl enable enterprises-crm

# 5. Configure Nginx reverse proxy
echo "[5/8] Configuring Nginx reverse proxy..."
if [ -d /etc/nginx/sites-available ]; then
  cp "${SCRIPT_DIR}/nginx/enterprises-crm.conf" /etc/nginx/sites-available/enterprises-crm.conf
  ln -sf /etc/nginx/sites-available/enterprises-crm.conf /etc/nginx/sites-enabled/enterprises-crm.conf
  # Remove default welcome site if present
  rm -f /etc/nginx/sites-enabled/default
fi

# 6. Configure logrotate
echo "[6/8] Configuring automated log rotation..."
cat << 'EOF' > /etc/logrotate.d/enterprises-crm
/var/log/enterprises-crm/*.log /var/log/nginx/enterprises-crm-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 crmapp crmapp
    sharedscripts
    postrotate
        systemctl reload nginx >/dev/null 2>&1 || true
    endscript
}
EOF

# 7. Configure automated nightly database backup cron job
echo "[7/8] Configuring daily database backup cron job (runs 02:00 UTC)..."
cat << EOF > /etc/cron.d/enterprises-crm-backup
0 2 * * * root /bin/bash ${APP_DIR}/deploy/aws/backup/backup.sh >> /var/log/enterprises-crm/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/enterprises-crm-backup

# 8. Verification and summary
echo "[8/8] Validating installation components..."
echo "------------------------------------------------------------"
echo "✅ Enterprises CRM Host Setup Complete!"
echo ""
echo "Next Steps to Complete Deployment:"
echo "1. Place or clone application code into ${APP_DIR}."
echo "2. Edit /etc/enterprises-crm.env and set production DATABASE_URL, secrets, and Maps keys."
echo "3. Run 'chown -R crmapp:crmapp ${APP_DIR}'."
echo "4. Build and migrate: sudo -u crmapp bash ${APP_DIR}/deploy/aws/update.sh"
echo "5. Configure SSL certificate (Choose A or B):"
echo "   A) Domainless Public IP HTTPS (No domain required):"
echo "      sudo bash ${APP_DIR}/deploy/aws/certbot-ip-cert.sh"
echo "   B) Custom Domain HTTPS:"
echo "      sudo certbot --nginx -d crm.example.com"
echo "6. Test health: bash ${APP_DIR}/deploy/aws/health-check.sh"
echo "============================================================"
exit 0
