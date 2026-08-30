#!/bin/bash
# Trigger JARVIS Vision Telemetry & Gesture Benchmark
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$DIR/hand_tracker/vision_logger.py" "${1:-5}"
