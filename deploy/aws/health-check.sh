#!/usr/bin/env bash
# ==============================================================================
# ENTERPRISES CRM — AWS EC2 PRODUCTION HEALTH CHECK
# ==============================================================================
# Usage: ./health-check.sh [--quiet]
# Checks:
#   1. Process & Systemd service status
#   2. Fastify API /health (Liveness)
#   3. Fastify API /ready (Database & Redis connectivity)
#   4. Redis server ping
#   5. PostgreSQL server ping
#   6. Nginx proxy status (if Nginx is running)
# ==============================================================================

set -euo pipefail

QUIET=false
if [ "${1:-}" == "--quiet" ]; then
  QUIET=true
fi

FAILURES=0

log_status() {
  local service="$1"
  local status="$2"
  local details="$3"
  if [ "${QUIET}" = false ]; then
    printf "%-25s : %-10s %s\n" "${service}" "${status}" "${details}"
  fi
}

# 1. Systemd Service Check
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet enterprises-crm 2>/dev/null; then
    log_status "systemd:enterprises-crm" "ACTIVE" "(running)"
  else
    log_status "systemd:enterprises-crm" "FAILED" "(service not active)"
    # Non-fatal if running in docker or direct CLI mode, but flag failure if installed
    if [ -f /etc/systemd/system/enterprises-crm.service ]; then
      FAILURES=$((FAILURES + 1))
    fi
  fi
fi

# 2. Redis Check
if command -v redis-cli >/dev/null 2>&1; then
  REDIS_PING="$(redis-cli ping 2>/dev/null || echo "FAIL")"
  if [ "${REDIS_PING}" == "PONG" ]; then
    log_status "Redis Server" "HEALTHY" "(PONG received)"
  else
    log_status "Redis Server" "UNHEALTHY" "(No response on 127.0.0.1:6379)"
    FAILURES=$((FAILURES + 1))
  fi
fi

# 3. PostgreSQL Check
if command -v pg_isready >/dev/null 2>&1; then
  if pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
    log_status "PostgreSQL Server" "HEALTHY" "(accepting connections)"
  else
    log_status "PostgreSQL Server" "UNHEALTHY" "(not accepting connections)"
    FAILURES=$((FAILURES + 1))
  fi
fi

# 4. Fastify Liveness Probe (/health)
HEALTH_PORT="${PORT:-4000}"
HEALTH_URL="http://127.0.0.1:${HEALTH_PORT}/health"
HEALTH_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${HEALTH_URL}" 2>/dev/null || echo "000")"

if [ "${HEALTH_CODE}" == "200" ]; then
  log_status "API Liveness (/health)" "HEALTHY" "(HTTP 200 OK)"
else
  log_status "API Liveness (/health)" "UNHEALTHY" "(HTTP ${HEALTH_CODE} from ${HEALTH_URL})"
  FAILURES=$((FAILURES + 1))
fi

# 5. Fastify Readiness Probe (/ready)
READY_URL="http://127.0.0.1:${HEALTH_PORT}/ready"
READY_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${READY_URL}" 2>/dev/null || echo "000")"

if [ "${READY_CODE}" == "200" ]; then
  log_status "API Readiness (/ready)" "HEALTHY" "(DB & Redis connected)"
else
  log_status "API Readiness (/ready)" "UNHEALTHY" "(HTTP ${READY_CODE} from ${READY_URL})"
  FAILURES=$((FAILURES + 1))
fi

# 6. Nginx Check
if command -v nginx >/dev/null 2>&1; then
  if systemctl is-active --quiet nginx 2>/dev/null; then
    log_status "Nginx Reverse Proxy" "ACTIVE" "(running)"
  else
    log_status "Nginx Reverse Proxy" "INACTIVE" "(stopped)"
  fi
fi

if [ "${FAILURES}" -gt 0 ]; then
  if [ "${QUIET}" = false ]; then
    echo "============================================================"
    echo "❌ HEALTH CHECK FAILED: ${FAILURES} service(s) unhealthy."
    echo "============================================================"
  fi
  exit 1
else
  if [ "${QUIET}" = false ]; then
    echo "============================================================"
    echo "✅ ALL SERVICES HEALTHY"
    echo "============================================================"
  fi
  exit 0
fi
