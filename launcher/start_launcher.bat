@echo off
REM Start the launcher service on Windows

cd /d "%~dp0"

REM Refresh PATH to pick up recent Python installs
set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"

REM Create virtual environment if needed
if not exist "venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv venv --without-pip
    echo Installing pip...
    venv\Scripts\python.exe -m ensurepip --upgrade
)

REM Install dependencies
echo Installing dependencies...
venv\Scripts\python.exe -m pip install -r requirements.txt -q

REM Start the launcher
echo Starting launcher service on http://localhost:8080
venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
