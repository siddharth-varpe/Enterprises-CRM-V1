#!/usr/bin/env bash
set -euo pipefail

# Enterprises CRM — Cloudflare Quick Tunnel Helper
# Exposes http://localhost:3000 over a valid HTTPS origin for mobile browser GPS testing.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_PATH="${REPO_ROOT}/scripts/bin/cloudflared"

if [[ -x "${BIN_PATH}" ]]; then
  CLOUDFLARED_BIN="${BIN_PATH}"
elif command -v cloudflared &>/dev/null; then
  CLOUDFLARED_BIN="$(command -v cloudflared)"
else
  echo "Error: cloudflared binary not found at ${BIN_PATH} or in system PATH."
  echo "Run scripts to download cloudflared or install via your package manager."
  exit 1
fi

echo "===================================================================="
echo " Enterprises CRM — Cloudflare Quick Tunnel for Mobile GPS Testing   "
echo "===================================================================="
echo "Target local service: http://localhost:3000"
echo "(Vite frontend proxies /api, /health, /ready, and /socket.io to Fastify port 4000)"
echo ""

# Verify local dev server is responding
if ! curl -s -m 2 http://localhost:3000 >/dev/null 2>&1; then
  echo "[WARNING] http://localhost:3000 is not responding."
  echo "          Ensure the development server is running in another terminal:"
  echo "          $ pnpm dev"
  echo ""
fi

echo "Starting tunnel... Cloudflare will output your temporary HTTPS URL."
echo ""
echo "ON YOUR PHONE (TESTING INSTRUCTIONS):"
echo "  1. Copy the https://*.trycloudflare.com URL from the output below."
echo "  2. Open https://<tunnel-url>/technician on your smartphone."
echo "  3. Log in with technician credentials."
echo "  4. Tap 'Enable Location' or 'Navigate' and allow GPS access."
echo "  5. Real GPS coordinates will stream through the tunnel to the CRM!"
echo ""
echo "ON ADMIN DESKTOP:"
echo "  View live tracking at: http://localhost:3000/technicians/map"
echo ""
echo "SECURITY NOTE:"
echo "  Quick tunnels are public, temporary, and meant only for developer testing."
echo "  Press Ctrl+C when finished to cleanly stop the tunnel."
echo "===================================================================="
echo ""

exec "${CLOUDFLARED_BIN}" tunnel --url http://localhost:3000
