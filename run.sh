#!/usr/bin/env bash
# CourseCone launcher (Windows Git Bash / Linux / macOS) — one server, UI included
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

# --- locate a working Python (version-agnostic) ---
winpath() { command -v cygpath >/dev/null && cygpath -u "$1" || echo "$1"; }
PY=""
CANDIDATES=("$(command -v python3 2>/dev/null)" "$(command -v python 2>/dev/null)")
[ -n "$LOCALAPPDATA" ] && CANDIDATES+=("$(winpath "$LOCALAPPDATA")"/Programs/Python/*/python.exe)
CANDIDATES+=("$HOME"/AppData/Local/Programs/Python/*/python.exe /c/Python*/python.exe)
for cand in "${CANDIDATES[@]}"; do
  # glob may not expand -> skip non-files; must run AND have our deps
  [ -f "$cand" ] || continue
  "$cand" -c "import sys, uvicorn, streamlit" 2>/dev/null || \
    "$cand" -c "import sys, uvicorn" 2>/dev/null || continue
  case "$cand" in *WindowsApps*) continue ;; esac   # MS Store stub
  PY="$cand"; break
done
[ -z "$PY" ] && { echo "ERROR: Python not found"; exit 1; }
echo "Using Python: $PY"

echo "[1/1] Starting CourseCone -> http://localhost:8000"
kill_port 8000
$PY -m uvicorn app.main:app --port 8000 &
for i in $(seq 1 30); do curl -s http://localhost:8000/ >/dev/null 2>&1 && break; sleep 0.5; done

# open the browser automatically
( start http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null ) &

wait
