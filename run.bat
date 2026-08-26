@echo off
REM CourseCone launcher - one server serves both API and UI
cd /d "%~dp0"
echo Starting CourseCone -> http://localhost:8000
start "" http://localhost:8000
python -m uvicorn app.main:app --port 8000
