#!/usr/bin/env bash
# Startet nur den Druckserver. Token kommt automatisch aus .print-token.
# Der Cloudflare-Tunnel läuft separat als Dienst (LaunchDaemon) und braucht
# hier nichts. Beenden mit Ctrl+C.
set -euo pipefail
cd "$(dirname "$0")"

[ -s .print-token ] || openssl rand -hex 24 > .print-token
TOKEN="$(tr -d '[:space:]' < .print-token)"

# Übrig gebliebene Quick-Tunnel (trycloudflare.com) beenden – es soll nur der
# feste sdtoll.de-Tunnel verwendet werden.
if pgrep -f "cloudflared tunnel --url http://localhost:8787" >/dev/null 2>&1; then
  echo "Beende temporären Quick-Tunnel …"
  pkill -f "cloudflared tunnel --url http://localhost:8787" 2>/dev/null || true
  sleep 0.5
fi
PORT="${PORT:-8787}"
PUBLIC_HOST="${PUBLIC_HOST:-$(cat .print-host 2>/dev/null || true)}"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$LAN_IP" ]; then
  IFACE="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
  [ -n "$IFACE" ] && LAN_IP="$(ipconfig getifaddr "$IFACE" 2>/dev/null || true)"
fi
[ -n "$LAN_IP" ] || LAN_IP=127.0.0.1

echo
if [ -n "$PUBLIC_HOST" ]; then
  echo "POS-URL:        https://$PUBLIC_HOST/$TOKEN"
  echo "Health:         https://$PUBLIC_HOST/$TOKEN/health"
fi
echo "Im WLAN:        http://$LAN_IP:$PORT/$TOKEN"
echo "Designer lokal: http://localhost:$PORT/$TOKEN/designer"
echo "Token:          $TOKEN"
echo
echo "Beenden: Ctrl+C"
echo

exec env PORT="$PORT" python3 -u server.py
