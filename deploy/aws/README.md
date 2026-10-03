# Enterprises CRM — AWS EC2 Production Deployment Manual

## 1. Overview & Architectural Model

Enterprises CRM is architected for deployment as a single, cohesive, production-grade application on a single **AWS EC2 instance** running **Ubuntu Linux**.

### Architecture Diagram

```text
               Public Internet (Clients / Technicians / Admins)
                                       │
                                       │ HTTPS (443) / HTTP (80)
                                       ▼
                       ┌──────────────────────────────┐
                       │   AWS Security Group (SG)    │
                       │   - Inbound: 80, 443, 22     │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │     Nginx Reverse Proxy      │
                       │     - SSL/TLS Termination    │
                       │     - Static Asset Caching   │
                       │     - HTTP/1.1 WS Upgrades   │
                       └──────────────┬───────────────┘
                                      │
                                      │ Reverse Proxy Loopback (127.0.0.1:4000)
                                      ▼
                       ┌──────────────────────────────┐
                       │   Integrated Fastify Server  │
                       │   - Admin CRM SPA Serving    │
                       │   - Technician Portal SPA    │
                       │   - REST APIs (/api/v1/*)    │
                       │   - Socket.IO Realtime GW    │
                       └───────┬──────────────┬───────┘
                               │              │
                   SQL Queries │              │ In-Memory Key/Value
               (127.0.0.1:5432)│              │ (127.0.0.1:6379)
                               ▼              ▼
                    ┌─────────────────┐ ┌───────────────┐
                    │   PostgreSQL    │ │ Redis Server  │
                    │   (Persistent)  │ │ (TTL / Temp)  │
                    └─────────────────┘ └───────────────┘
```

### Key Architectural Tenets
1. **One Repository, One Main Branch, One Integrated Application**: The Admin CRM, Technician Portal, REST APIs, and Socket.IO realtime server operate inside one unified codebase and run under one Fastify server.
2. **One Database Authority**: PostgreSQL (local port 5432) is the sole source of truth for business data.
3. **One Redis Authority**: Redis (local port 6379) serves transient OTP challenges, rate-limiting tokens, and short-lived GPS coordinates with TTL cleanup. **No permanent GPS tables exist in PostgreSQL.**
4. **Zero Business Logic Mutations**: The deployment infrastructure adapts strictly to the CRM; the CRM code and business semantics are untouched.

---

## 2. System & EC2 Prerequisites

### Supported CPU Architecture
* **x86_64 (amd64)**: **SUPPORTED & STRONGLY RECOMMENDED**. All native binary dependencies (including `argon2`, `node-gyp-build`, and `esbuild`) bundle native x86_64 prebuilts.
* **ARM64 (aarch64 / Graviton)**: REQUIRES TESTING. Although `argon2` contains `linux-arm64` prebuilt bindings, `esbuild` and npm optional dependencies must resolve dynamically on Graviton. For maximum stability and immediate production zero-risk deployment, launch an **x86_64** instance.

### Recommended EC2 Instance Sizing
* **Minimum**: `t3.medium` (2 vCPU, 4 GiB RAM, 30 GiB gp3 EBS volume).
* **Recommended Production**: `t3.large` or `c6i.large` (2 vCPU, 8 GiB RAM, 50 GiB gp3 EBS volume).
* **Operating System**: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** (Server Minimal or Standard).

---

## 3. AWS Security Group Configuration

Configure an AWS EC2 Security Group with the following rules:

### Inbound Rules
| Type | Port Range | Protocol | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **HTTP** | 80 | TCP | `0.0.0.0/0`, `::/0` | Let's Encrypt verification & HTTPS redirection |
| **HTTPS** | 443 | TCP | `0.0.0.0/0`, `::/0` | Production encrypted CRM and API traffic |
| **SSH** | 22 | TCP | `YOUR_OFFICE_IP/32` | Administrative shell access (**NEVER 0.0.0.0/0**) |

### Internal / Loopback (Blocked from Internet)
* **Port 5432 (PostgreSQL)**: Must NOT be exposed in the Security Group. Bound strictly to `127.0.0.1`.
* **Port 6379 (Redis)**: Must NOT be exposed in the Security Group. Bound strictly to `127.0.0.1`.
* **Port 4000 (Fastify)**: Must NOT be exposed in the Security Group. Reverse-proxied internally via Nginx.

### IMDSv2 (EC2 Instance Metadata Security)
In AWS EC2 Console, ensure **Instance Metadata Service v2 (IMDSv2)** is set to **Required** with `Hop Limit = 1` to prevent SSRF credential interception.

---

## 4. Software Dependencies & Runtime Versions

* **Node.js**: `v20.18.3` LTS (Node 20 active LTS)
* **pnpm**: `9.15.4` (Corepack managed)
* **PostgreSQL**: `16.x` (or `15.x`)
* **Redis**: `7.x` (or `6.x`)
* **Nginx**: `1.18+` or `1.24+` with HTTP/2 support
* **Process Manager**: **systemd** (Native Linux service supervisor)

---

## 5. Step-by-Step Installation Procedure

### Step 5.1: Automatic Instance Provisioning (User-Data)
When launching the EC2 instance, you can paste [`deploy/aws/bootstrap.sh`](file:///home/siddharth/Desktop/SR-Enterprises-CRM-Software-V1/deploy/aws/bootstrap.sh) into the **User Data** field under Advanced Details. It automatically installs Node.js 20, pnpm, Nginx, PostgreSQL, Redis, and build essentials.

Alternatively, execute the bootstrap manually on the instance:
```bash
sudo bash deploy/aws/bootstrap.sh
```

### Step 5.2: Create Dedicated Linux User & Directories
Run the automated installation script:
```bash
sudo bash deploy/aws/install.sh
```
This script creates:
* Dedicated non-root user: `crmapp` (`/usr/sbin/nologin`)
* Application root: `/opt/enterprises-crm`
* Document storage: `/var/lib/enterprises-crm/storage/documents`
* Database backups: `/var/backups/enterprises-crm` (mode `0700`)
* Application logs: `/var/log/enterprises-crm`
* Environment file: `/etc/enterprises-crm.env` (mode `0600`)

### Step 5.3: Place Application Code
Clone or checkout the repository to `/opt/enterprises-crm`:
```bash
sudo git clone https://github.com/your-org/SR-Enterprises-CRM-Software-V1.git /opt/enterprises-crm
sudo chown -R crmapp:crmapp /opt/enterprises-crm
```

### Step 5.4: PostgreSQL Setup
Access PostgreSQL to create the production user and database:
```bash
sudo -u postgres psql
```
```sql
CREATE USER crm_user WITH PASSWORD 'REPLACE_WITH_STRONG_RANDOM_PASSWORD';
CREATE DATABASE enterprises_crm OWNER crm_user;
GRANT ALL PRIVILEGES ON DATABASE enterprises_crm TO crm_user;
\q
```

Ensure PostgreSQL binds strictly to localhost in `/etc/postgresql/16/main/postgresql.conf`:
```text
listen_addresses = 'localhost'
```
Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Step 5.5: Redis Setup
Ensure Redis binds strictly to localhost and enables protected mode in `/etc/redis/redis.conf`:
```text
bind 127.0.0.1 ::1
protected-mode yes
```
Restart Redis:
```bash
sudo systemctl restart redis-server
```

### Step 5.6: Configure Production Environment Variables
Edit `/etc/enterprises-crm.env` and populate all placeholders:
```bash
sudo nano /etc/enterprises-crm.env
```
Generate high-entropy random keys:
```bash
openssl rand -hex 32   # Use for COOKIE_SECRET
openssl rand -hex 32   # Use for SESSION_SECRET
```
Ensure proper permissions:
```bash
sudo chown root:crmapp /etc/enterprises-crm.env
sudo chmod 600 /etc/enterprises-crm.env
```

---

## 6. Build & Migration Procedure

Build the production artifacts and apply database migrations under the unprivileged service user:
```bash
sudo -u crmapp bash -c "cd /opt/enterprises-crm && pnpm install --frozen-lockfile"
sudo -u crmapp bash -c "cd /opt/enterprises-crm && pnpm --filter @crm/web build"
sudo -u crmapp bash -c "cd /opt/enterprises-crm && pnpm --filter @crm/api build"
sudo -u crmapp bash -c "cd /opt/enterprises-crm && pnpm db:migrate"
```

---

## 7. Starting & Managing the Systemd Service

Start and enable the background service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable enterprises-crm
sudo systemctl start enterprises-crm
```

Verify status:
```bash
sudo systemctl status enterprises-crm
```

To view live application logs:
```bash
journalctl -u enterprises-crm -f
```

---

## 8. Nginx & SSL Setup (HTTPS & Domain)

### Step 8.1: Point Domain DNS
In your DNS provider (e.g. AWS Route 53 or Cloudflare), create an **A Record** pointing your domain (e.g. `crm.example.com`) to the EC2 Public IPv4 address.

### Step 8.2: Obtain Free SSL Certificate via Certbot
```bash
sudo certbot --nginx -d crm.example.com
```
Certbot will automatically obtain certificates and configure HTTPS in `/etc/nginx/sites-available/enterprises-crm.conf`.

Test Nginx configuration:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. Verifying the Deployment

Run the automated health check suite:
```bash
bash /opt/enterprises-crm/deploy/aws/health-check.sh
```

### Expected Output
```text
systemd:enterprises-crm   : ACTIVE     (running)
Redis Server              : HEALTHY    (PONG received)
PostgreSQL Server         : HEALTHY    (accepting connections)
API Liveness (/health)    : HEALTHY    (HTTP 200 OK)
API Readiness (/ready)    : HEALTHY    (DB & Redis connected)
Nginx Reverse Proxy       : ACTIVE     (running)
============================================================
✅ ALL SERVICES HEALTHY
============================================================
```

### Manual Functional Checks
1. **Admin Login & Dashboard**: Navigate to `https://crm.example.com/` and log in with Super Admin credentials.
2. **Technician Portal**: Navigate to `https://crm.example.com/technician`. Verify OTP request sends an email, authenticates, and opens `/technician` without loading the Admin sidebar.
3. **Live Geolocation Tracking**:
   * On mobile or device browser, technician clicks "Navigate" on an assigned service.
   * Device begins sending GPS updates via `navigator.geolocation.watchPosition()`.
   * On Admin CRM -> Live Map (`/maps`), technician marker appears in realtime via Socket.IO `/maps` room.
   * Check Redis (`redis-cli keys "tech_location:*"`): temporary location key exists with TTL <= 7200s.
   * Check PostgreSQL: no permanent GPS records written.

---

## 10. Automated Maintenance & Operations

### Database Backups
A nightly cron job (`/etc/cron.d/enterprises-crm-backup`) runs every day at 02:00 UTC:
```bash
# Manual trigger:
sudo /bin/bash /opt/enterprises-crm/deploy/aws/backup/backup.sh
```
* Location: `/var/backups/enterprises-crm/`
* Format: `enterprises_crm_backup_YYYYMMDD_HHMMSSZ.sql.gz`
* Retention: 14 days (automatically pruned only after verifying gzip integrity).

### Database Restoration
```bash
sudo /bin/bash /opt/enterprises-crm/deploy/aws/backup/restore.sh /var/backups/enterprises-crm/enterprises_crm_backup_YYYYMMDD_HHMMSSZ.sql.gz --confirm
```
* Pre-flight checks: verifies `.gz` archive integrity and SHA-256 checksum.
* Safety measure: automatically creates an emergency pre-restore snapshot of the active database before modifying data.

### Deploying Code Updates
To deploy updates without downtime guesswork:
```bash
sudo bash /opt/enterprises-crm/deploy/aws/update.sh main
```

### Emergency Rollback
To immediately roll back to the previous commit or specific tag:
```bash
sudo bash /opt/enterprises-crm/deploy/aws/rollback.sh HEAD~1
```

---

## 11. Log Files & Troubleshooting

| Component | Log Location / Command |
| :--- | :--- |
| **Fastify API / CRM** | `journalctl -u enterprises-crm -n 100 -f` |
| **Nginx Access** | `/var/log/nginx/enterprises-crm-access.log` |
| **Nginx Errors** | `/var/log/nginx/enterprises-crm-error.log` |
| **PostgreSQL** | `/var/log/postgresql/postgresql-16-main.log` |
| **Redis** | `/var/log/redis/redis-server.log` |
| **Database Backups** | `/var/log/enterprises-crm/backup.log` |

### Common Issues & Resolutions
1. **502 Bad Gateway from Nginx**:
   * Check if backend service is running: `sudo systemctl status enterprises-crm`.
   * Check if Fastify is listening on 127.0.0.1:4000: `ss -tulpn | grep 4000`.
   * Inspect recent crash logs: `journalctl -u enterprises-crm -e`.
2. **Socket.IO Connection Failed**:
   * Ensure Nginx configuration includes `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection $connection_upgrade;`.
   * Verify CORS allows the production domain in `/etc/enterprises-crm.env` (`CORS_ALLOWED_ORIGINS`).
3. **Technician OTP Email Not Arriving**:
   * Inspect SMTP settings in `/etc/enterprises-crm.env`.
   * If using Gmail, verify you are using an **App Password** with 2-factor authentication enabled, on port `465` with `ssl`.
4. **Geolocation Not Triggering**:
   * Geolocation requires a secure context (**HTTPS**). Ensure your site is served over SSL.
   * Ensure the mobile device has granted location permission to the browser.
