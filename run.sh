#!/usr/bin/env bash
# CampusPeer launcher (Linux / macOS / Git Bash on Windows)
cd "$(dirname "$0")"

# Skip Streamlit's one-time telemetry email prompt
mkdir -p "$HOME/.streamlit"
[ -f "$HOME/.streamlit/credentials.toml" ] || : > "$HOME/.streamlit/credentials.toml"

cleanup() {
  echo "Stopping services..."
  kill 0 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "[1/2] Starting backend -> http://localhost:8000/docs"
uvicorn app.main:app --reload --port 8000 &
API_PID=$!

# wait for the API to accept connections
for i in $(seq 1 20); do
  curl -s http://localhost:8000/ >/dev/null 2>&1 && break
  sleep 0.5
done

echo "[2/2] Starting frontend -> http://localhost:8501"
streamlit run frontend/streamlit_app.py

wait $API_PID
