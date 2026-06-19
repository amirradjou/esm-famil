#!/usr/bin/env bash
# Build the server and expose it from this machine through Tailscale Funnel.
# Usage: scripts/serve-local.sh [port]     (needs `tailscale set --operator=$USER` once)
set -euo pipefail

port="${1:-${PORT:-3000}}"
cd "$(dirname "$0")/.."

pnpm --filter @esm-famil/shared build >/dev/null
pnpm --filter @esm-famil/server build >/dev/null

if systemctl --user is-enabled esm-famil >/dev/null 2>&1; then
  systemctl --user restart esm-famil
  echo "server: restarted user service esm-famil (journalctl --user -u esm-famil -f)"
else
  echo "server: user service not installed; see deploy/esm-famil.service. Starting in the foreground instead."
  PORT="$port" node --env-file-if-exists=.env apps/server/dist/index.js &
  trap 'kill %1 2>/dev/null || true' EXIT
fi

# --bg keeps the funnel configured across reboots; it only forwards :443 -> localhost:port.
tailscale funnel --bg "$port"
url=$(tailscale status --json | python3 -c 'import sys,json; print("https://" + json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
echo "public URL: $url   (set VITE_SERVER_URL to this for the Netlify build)"

for _ in $(seq 1 20); do
  if curl -sf "$url/healthz" >/dev/null; then
    echo "healthz: ok"
    exit 0
  fi
  sleep 1
done
echo "healthz not reachable through the funnel yet; check 'tailscale funnel status' and the server log" >&2
exit 1
