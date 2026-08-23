@echo off
REM CampusPeer launcher - one server serves both API and UI
cd /d "%~dp0"
echo Starting CampusPeer -> http://localhost:8000
start "" http://localhost:8000
python -m uvicorn app.main:app --port 8000
