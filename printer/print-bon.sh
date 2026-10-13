#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# print-bon.sh – schneller Test: schickt rohe ESC/POS-Bytes an den Bondrucker.
#
# Verwendung:
#   ./print-bon.sh "Was ist ein Baum? Ein Baum ist eine Pflanze."
#   ./print-bon.sh                 # nutzt einen Beispieltext
#
# Der Drucker wird über CUPS angesprochen. Queue-Name ggf. anpassen.
# ---------------------------------------------------------------------------
set -euo pipefail

PRINTER="${PRINTER_NAME:-Bondrucker}"
TEXT="${1:-Was ist ein Baum? Ein Baum ist eine Pflanze.}"

# ESC @ = initialisieren, Text, LF, GS V B 0 = Teil-Schnitt (Autocut).
printf "\x1b@%b\n\x1dV\x42\x00" "$TEXT" | lp -d "$PRINTER" -o raw

echo "Bon an '$PRINTER' gesendet."
