#!/usr/bin/env bash
# CampusPeer launcher (Windows Git Bash / Linux / macOS) — one server, UI included
cd "$(dirname "$0")"

kill_port() {
  if command -v netstat >/dev/null; then
    for pid in $(netstat -ano | grep "LISTENING" | grep ":$1" | awk '{print $NF}' | sort -u); do
      taskkill //F //PID "$pid" 2>/dev/null || true
    done
  fi
}
cleanup() { echo; echo "Stopping..."; kill $(jobs -p) 2>/dev/null; }
trap cleanup EXIT INT TERM

# --- locate a working Python ---
PY=""
for cand in "$(command -v python 2>/dev/null)" \
            "$(command -v py 2>/dev/null)" \
            "$LOCALAPPDATA/Programs/Python/Python313/python.exe" \
            "$HOME/AppData/Local/Programs/Python/Python313/python.exe"; do
  [ -n "$cand" ] && [ -x "$cand" ] && "$cand" -c "import sys" 2>/dev/null || continue
  PY="$cand"; break
done
[ -z "$PY" ] && { echo "ERROR: Python not found"; exit 1; }
PYRUN="$PY"; [ "$(basename "$PY")" = "py.exe" ] && PYRUN="$PY -3"
echo "Using Python: $PY"

echo "[1/1] Starting CampusPeer -> http://localhost:8000"
kill_port 8000
$PYRUN -m uvicorn app.main:app --port 8000 &
for i in $(seq 1 30); do curl -s http://localhost:8000/ >/dev/null 2>&1 && break; sleep 0.5; done

# open the browser automatically
( start http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null ) &

wait
