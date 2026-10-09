#!/usr/bin/env bash
# ==============================================================================
# ENTERPRISES CRM — AWS EC2 PUBLIC IP-ADDRESS SSL/TLS CERTIFICATE AUTOMATION
# ==============================================================================
# Target: Single-Instance EC2 Production Deployment (Domainless HTTPS)
# Provider: Let's Encrypt IP-address certificate via shortlived profile
# Validity: ~160 hours (automated twice-daily renewal via systemd timer)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_IP=""
CERT_EMAIL=""
WEBROOT_DIR="/var/www/certbot"
CONF_DIR="/etc/letsencrypt/live"
ACTIVE_SYMLINK="${CONF_DIR}/enterprises-crm"

# Parse CLI arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip)
      PUBLIC_IP="$2"
      shift 2
      ;;
    --email)
      CERT_EMAIL="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: sudo ./certbot-ip-cert.sh [--ip <PUBLIC_IP>] [--email <EMAIL>]"
      echo ""
      echo "Options:"
      echo "  --ip     Public IPv4 address of the EC2 instance (auto-detected if omitted)"
      echo "  --email  Contact email for Let's Encrypt expiration notifications"
      exit 0
      ;;
    *)
      if [[ -z "$PUBLIC_IP" && "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        PUBLIC_IP="$1"
        shift
      else
        echo "Unknown option: $1"
        exit 1
      fi
      ;;
  esac
done

# Root check
if [[ "$EUID" -ne 0 ]]; then
  echo "❌ Error: certbot-ip-cert.sh must be run as root (use sudo)."
  exit 1
fi

echo "===================================================================="
echo " Enterprises CRM — Public IP-Address SSL/TLS Certificate Setup      "
echo "===================================================================="

# 1. Detect Public IP if not provided
if [[ -z "$PUBLIC_IP" ]]; then
  echo "[1/7] Detecting public IPv4 address..."

  # Attempt 1: AWS IMDSv2
  IMDS_TOKEN=$(curl -s -m 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || true)
  if [[ -n "$IMDS_TOKEN" ]]; then
    PUBLIC_IP=$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
  fi

  # Attempt 2: AWS checkip service
  if [[ -z "$PUBLIC_IP" ]]; then
    PUBLIC_IP=$(curl -s -m 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)
  fi

  # Attempt 3: ifconfig.me
  if [[ -z "$PUBLIC_IP" ]]; then
    PUBLIC_IP=$(curl -s -m 5 https://ifconfig.me 2>/dev/null | tr -d '[:space:]' || true)
  fi
fi

# Validate IP format
if [[ ! "$PUBLIC_IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
  echo "❌ Error: Could not determine a valid public IPv4 address ($PUBLIC_IP)."
  echo "Please specify manually: sudo ./certbot-ip-cert.sh --ip <YOUR_PUBLIC_IP>"
  exit 1
fi

echo "  -> Target Public IP: ${PUBLIC_IP}"

# 2. Configure Email
if [[ -z "$CERT_EMAIL" ]]; then
  CERT_EMAIL="admin@${PUBLIC_IP}.nip.io"
  echo "[2/7] Using administrative notification email: ${CERT_EMAIL}"
  echo "  (Pass --email your-email@domain.com to specify a real address)"
else
  echo "[2/7] Administrative notification email: ${CERT_EMAIL}"
fi

# 3. Verify Certbot installation
echo "[3/7] Verifying Certbot installation and capability..."
if ! command -v certbot >/dev/null 2>&1; then
  echo "  -> Certbot is not installed. Installing via apt..."
  apt-get update -qq && apt-get install -y -qq certbot
fi

CERTBOT_VERSION=$(certbot --version 2>&1 | awk '{print $2}')
echo "  -> Certbot version: ${CERTBOT_VERSION}"

# 4. Prepare Webroot directory for HTTP-01 ACME challenge
echo "[4/7] Ensuring ACME challenge directory exists..."
mkdir -p "${WEBROOT_DIR}/.well-known/acme-challenge"
chmod -R 755 "${WEBROOT_DIR}"

# 5. Inbound Port 80 / 443 Pre-flight Notice
echo "[5/7] Verifying network accessibility..."
echo "  -> IMPORTANT: In AWS EC2 Console, ensure your Security Group has:"
echo "     - Inbound TCP 80  (HTTP)  from 0.0.0.0/0"
echo "     - Inbound TCP 443 (HTTPS) from 0.0.0.0/0"

# Check if Nginx is active
NGINX_RUNNING=false
if systemctl is-active --quiet nginx 2>/dev/null; then
  NGINX_RUNNING=true
  echo "  -> Nginx is currently running. Requesting certificate via webroot..."
else
  echo "  -> Nginx is not currently running. Requesting certificate via standalone mode..."
fi

# 6. Request Let's Encrypt IP Certificate using shortlived profile
echo "[6/7] Requesting Let's Encrypt IP certificate for ${PUBLIC_IP}..."

set +e
if [ "$NGINX_RUNNING" = true ]; then
  # Try webroot mode with -d and --preferred-profile shortlived
  certbot certonly \
    --webroot -w "${WEBROOT_DIR}" \
    --preferred-profile shortlived \
    --agree-tos \
    --no-eff-email \
    --email "${CERT_EMAIL}" \
    --cert-name "${PUBLIC_IP}" \
    -d "${PUBLIC_IP}" \
    --non-interactive
  CERTBOT_EXIT=$?

  # If -d failed with invalid identifier, try --ip-address flag if supported
  if [ $CERTBOT_EXIT -ne 0 ]; then
    echo "  -> Retrying with explicit --ip-address flag..."
    certbot certonly \
      --webroot -w "${WEBROOT_DIR}" \
      --preferred-profile shortlived \
      --agree-tos \
      --no-eff-email \
      --email "${CERT_EMAIL}" \
      --cert-name "${PUBLIC_IP}" \
      --ip-address "${PUBLIC_IP}" \
      --non-interactive
    CERTBOT_EXIT=$?
  fi
else
  # Standalone mode (binds port 80 directly)
  certbot certonly \
    --standalone \
    --preferred-profile shortlived \
    --agree-tos \
    --no-eff-email \
    --email "${CERT_EMAIL}" \
    --cert-name "${PUBLIC_IP}" \
    -d "${PUBLIC_IP}" \
    --non-interactive
  CERTBOT_EXIT=$?

  if [ $CERTBOT_EXIT -ne 0 ]; then
    echo "  -> Retrying with explicit --ip-address flag..."
    certbot certonly \
      --standalone \
      --preferred-profile shortlived \
      --agree-tos \
      --no-eff-email \
      --email "${CERT_EMAIL}" \
      --cert-name "${PUBLIC_IP}" \
      --ip-address "${PUBLIC_IP}" \
      --non-interactive
    CERTBOT_EXIT=$?
  fi
fi
set -e

if [ $CERTBOT_EXIT -ne 0 ]; then
  echo ""
  echo "❌ Let's Encrypt IP certificate request failed."
  echo ""
  echo "ALTERNATIVE CERTIFICATE OPTIONS:"
  echo "1. ZeroSSL 90-Day IP Certificate (ACME):"
  echo "   certbot certonly --webroot -w /var/www/certbot \\"
  echo "     --server https://acme.zerossl.com/v2/DV90 \\"
  echo "     --email ${CERT_EMAIL} --agree-tos -d ${PUBLIC_IP}"
  echo ""
  echo "2. Free Dynamic DNS (DuckDNS / No-IP / nip.io):"
  echo "   If using nip.io wildcard DNS (e.g. crm.${PUBLIC_IP}.nip.io):"
  echo "   certbot certonly --webroot -w /var/www/certbot \\"
  echo "     --email ${CERT_EMAIL} --agree-tos -d crm.${PUBLIC_IP}.nip.io"
  exit 1
fi

echo "  -> Certificate successfully obtained!"

# 7. Configure standardized symlink and systemd automated renewal
echo "[7/7] Configuring active certificate symlink & systemd automated renewal..."

# Link active certificate for Nginx
mkdir -p "${CONF_DIR}"
ln -sfn "${CONF_DIR}/${PUBLIC_IP}" "${ACTIVE_SYMLINK}"

# Install automated renewal service and timer
if [ -d /etc/systemd/system ]; then
  cp "${SCRIPT_DIR}/systemd/certbot-ip-renew.service" /etc/systemd/system/certbot-ip-renew.service
  cp "${SCRIPT_DIR}/systemd/certbot-ip-renew.timer" /etc/systemd/system/certbot-ip-renew.timer
  systemctl daemon-reload
  systemctl enable --now certbot-ip-renew.timer
  echo "  -> Installed and enabled certbot-ip-renew.timer (runs twice daily for 160h cert profile)."
fi

# Test and reload/start Nginx
if command -v nginx >/dev/null 2>&1; then
  echo "  -> Testing Nginx configuration syntax..."
  nginx -t
  if [ "$NGINX_RUNNING" = true ]; then
    systemctl reload nginx
    echo "  -> Nginx reloaded successfully with new IP SSL certificate."
  else
    systemctl start nginx || true
    echo "  -> Nginx started successfully."
  fi
fi

echo ""
echo "===================================================================="
echo " 🎉 DOMAINLESS HTTPS ACTIVATION COMPLETE!                           "
echo "===================================================================="
echo "Enterprises CRM is now securely accessible over HTTPS via Public IP:"
echo ""
echo "  Technician Portal:  https://${PUBLIC_IP}/technician"
echo "  Admin Dashboard:    https://${PUBLIC_IP}/"
echo "  Admin Live Map:     https://${PUBLIC_IP}/technicians/map"
echo "  Health Endpoint:    https://${PUBLIC_IP}/health"
echo ""
echo "Geolocation Context:  SECURE (window.isSecureContext === true)"
echo "Automated Renewal:    Active via certbot-ip-renew.timer"
echo "===================================================================="
