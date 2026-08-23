@echo off
REM CampusPeer launcher for Windows
cd /d "%~dp0"

if not exist "%USERPROFILE%\.streamlit" mkdir "%USERPROFILE%\.streamlit"
if not exist "%USERPROFILE%\.streamlit\credentials.toml" type nul > "%USERPROFILE%\.streamlit\credentials.toml"

echo [1/2] Starting backend -^> http://localhost:8000/docs
start "CampusPeer-API" cmd /c "uvicorn app.main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting frontend -^> http://localhost:8501
start "CampusPeer-UI" cmd /c "streamlit run frontend/streamlit_app.py"

echo Both services launched. Close the two windows to stop.
