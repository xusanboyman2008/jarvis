#!/bin/bash
# JARVIS / Barehands Board Command Dispatcher
# Sends JSON commands to the board /cmd endpoint on localhost
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT=$(python3 -c "import json; cfg = json.load(open('$DIR/jarvis.json')) if open('$DIR/jarvis.json') else {}; print(cfg.get('port', 8080))" 2>/dev/null || echo 8080)
JSON="${1:-}"
if [ -z "$JSON" ]; then
    echo "Usage: $0 '<json-command>'" >&2
    echo "Examples:" >&2
    echo "  $0 '{\"a\":\"present\",\"title\":\"STATUS\",\"body\":\"JARVIS Online\"}'" >&2
    echo "  $0 '{\"a\":\"add_card\",\"title\":\"NOTE\",\"body\":\"System Ready\"}'" >&2
    echo "  $0 '{\"a\":\"hand\",\"src\":\"models/damaged_helmet.glb\"}'" >&2
    echo "  $0 '{\"a\":\"explode\"}'" >&2
    echo "  $0 '{\"a\":\"reset\"}'" >&2
    exit 1
fi
curl -sS --max-time 5 -X POST "http://127.0.0.1:$PORT/cmd" \
    -H "Content-Type: application/json" \
    -d "$JSON" -o /dev/null -w "%{http_code}\n"
