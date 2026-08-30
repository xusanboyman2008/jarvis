#!/bin/bash
# JARVIS AI Face Ring Controller
# Sets ring state and mood
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE="${1:-idle}"
MOOD="${2:-cyan}"

echo "$STATE" > "$DIR/state/state"
NOW=$(date +%s)
echo "{\"mood\":\"$MOOD\",\"ts\":$NOW}" > "$DIR/state/mood.json"
echo "JARVIS Ring updated: state=$STATE, mood=$MOOD"
