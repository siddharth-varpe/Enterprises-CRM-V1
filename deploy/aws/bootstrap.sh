#!/usr/bin/env bash
# ==============================================================================
# ENTERPRISES CRM — AWS EC2 USER-DATA / CLOUD-INIT BOOTSTRAP SCRIPT
# ==============================================================================
# OS Target: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS (x86_64)
# Purpose: Clean system bootstrap installing only audited, required packages
# Usage: Paste into AWS EC2 Launch Instance -> Advanced Details -> User Data
# ==============================================================================

set -euo pipefail

# Output log to console and file
exec > >(tee /var/log/user-data-enterprises-crm.log | logger -t user-data -s 2>/dev/console) 2>&1

echo "============================================================"
echo "🚀  Enterprises CRM — EC2 Instance Bootstrap Starting"
echo "============================================================"

export DEBIAN_FRONTEND=noninteractive

# 1. System Update
echo "[1/7] Updating system packages..."
apt-get update -y
apt-get upgrade -y

# 2. Essential Tools & Build Requirements
echo "[2/7] Installing system tools & compiler dependencies..."
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gnupg \
  git \
  build-essential \
  python3 \
  ufw \
  logrotate \
  nginx \
  certbot \
  python3-certbot-nginx

# 3. Node.js 20 LTS (Active/Maintenance LTS)
echo "[3/7] Installing Node.js 20 LTS..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update -y
apt-get install -y nodejs

# Enable Corepack & pnpm 9.15.4
corepack enable
corepack prepare pnpm@9.15.4 --activate
echo "Node $(node -v) and pnpm $(pnpm -v) installed."

# 4. PostgreSQL (Version 16 or OS standard)
echo "[4/7] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Configure PostgreSQL: Listen strictly on localhost (never exposed to Internet)
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" /etc/postgresql/*/main/postgresql.conf
systemctl enable postgresql
systemctl restart postgresql

# 5. Redis (Local in-memory cache & realtime state)
echo "[5/7] Installing Redis..."
apt-get install -y redis-server

# Configure Redis: Bind to 127.0.0.1 loopback only, enable protected-mode
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf
sed -i 's/^protected-mode no/protected-mode yes/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server

# 6. Basic Firewall Hardening (UFW)
echo "[6/7] Configuring UFW firewall rules..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH Access (Restrict to trusted CIDR in AWS SG)'
ufw allow 80/tcp comment 'Nginx HTTP'
ufw allow 443/tcp comment 'Nginx HTTPS'
# Enable UFW without interactive prompt
echo "y" | ufw enable || true

# 7. Complete
echo "============================================================"
echo "✅  EC2 Instance Bootstrap Completed Successfully"
echo "============================================================"
echo "PostgreSQL: active on 127.0.0.1:5432"
echo "Redis:      active on 127.0.0.1:6379"
echo "Nginx:      active on 80/443"
echo "Node/pnpm:  Node $(node -v), pnpm $(pnpm -v)"
echo ""
echo "Next step: Run 'deploy/aws/install.sh' after checking out the CRM repository."
