#!/bin/bash
# JARVIS / Barehands Board State Inspector
# Fetches live spatial layout and objects on the board
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT=$(python3 -c "import json; cfg = json.load(open('$DIR/jarvis.json')) if open('$DIR/jarvis.json') else {}; print(cfg.get('port', 8080))" 2>/dev/null || echo 8080)
curl -sS --max-time 5 "http://127.0.0.1:$PORT/state" | python3 -m json.tool 2>/dev/null || echo "{}"
