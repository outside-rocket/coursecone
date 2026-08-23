#!/usr/bin/env bash
# CampusPeer launcher (Windows Git Bash / Linux / macOS)
cd "$(dirname "$0")"

# Skip Streamlit's one-time telemetry email prompt (needs [general] section)
mkdir -p "$HOME/.streamlit"
grep -q "\[general\]" "$HOME/.streamlit/credentials.toml" 2>/dev/null || \
  printf '[general]\nemail = ""\n' > "$HOME/.streamlit/credentials.toml"

kill_port() {  # free a port if a stale CampusPeer process still holds it
  if command -v netstat >/dev/null; then
    for pid in $(netstat -ano | grep "LISTENING" | grep ":$1" | awk '{print $NF}' | sort -u); do
      taskkill //F //PID "$pid" 2>/dev/null || true
    done
  fi
}

cleanup() {
  echo; echo "Stopping services..."
  kill $(jobs -p) 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "[1/2] Freeing port 8000 & starting backend -> http://localhost:8000/docs"
kill_port 8000

# --- locate a working Python (module invocation avoids PATH issues) ---
PY=""
for cand in "$(command -v python 2>/dev/null)" \
            "$(command -v py 2>/dev/null)" \
            "$LOCALAPPDATA/Programs/Python/Python313/python.exe" \
            "$HOME/AppData/Local/Programs/Python/Python313/python.exe" \
            "/c/Python313/python.exe"; do
  [ -n "$cand" ] && [ -x "$cand" ] && "$cand" -c "import sys" 2>/dev/null || continue
  case "$(basename "$cand")" in   # reject WindowsApps store stubs
    python.exe) "$cand" -c "exit(0)" 2>/dev/null || continue ;;
  esac
  PY="$cand"; break
done
if [ -z "$PY" ]; then echo "ERROR: Python not found"; exit 1; fi
# 'py' launcher needs a version arg
PYRUN="$PY"; [ "$(basename "$PY")" = "py.exe" ] && PYRUN="$PY -3"
echo "Using Python: $PY"

$PYRUN -m uvicorn app.main:app --port 8000 &
API_PID=$!

for i in $(seq 1 30); do curl -s http://localhost:8000/ >/dev/null 2>&1 && break; sleep 0.5; done

echo "[2/2] Starting frontend -> http://localhost:8501"
kill_port 8501
$PYRUN -m streamlit run frontend/streamlit_app.py

wait $API_PID
