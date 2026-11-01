#!/usr/bin/env bash
# Kompatibilitäts-Wrapper: startet nur den Druckserver.
#
# Der feste Cloudflare-Tunnel (…sdtoll.de) läuft als Systemdienst
# (LaunchDaemon com.cloudflare.cloudflared) und startet automatisch beim Login.
# Hier wird daher KEIN temporärer trycloudflare-Tunnel mehr erzeugt.
set -euo pipefail
cd "$(dirname "$0")"

# Alte Quick-Tunnel aus früheren Starts aufräumen.
if pgrep -f "cloudflared tunnel --url http://localhost:8787" >/dev/null 2>&1; then
  echo "Beende übrig gebliebenen Quick-Tunnel …"
  pkill -f "cloudflared tunnel --url http://localhost:8787" 2>/dev/null || true
  sleep 0.5
fi

if [ -z "${PUBLIC_HOST:-}" ] && [ -s .print-host ]; then
  PUBLIC_HOST="$(tr -d '[:space:]' < .print-host)"
  export PUBLIC_HOST
fi

if ! pgrep -f "cloudflared tunnel run" >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Hinweis: Der feste Cloudflare-Tunnel läuft gerade nicht.
Starten mit:  sudo launchctl kickstart -k system/com.cloudflare.cloudflared
EOF
fi

exec ./start.sh
