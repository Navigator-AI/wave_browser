#!/bin/bash
# Start the launcher service

cd "$(dirname "$0")"

# Determine python command (python3 on Unix, python on Windows)
if command -v python3 &> /dev/null; then
    PYTHON=python3
else
    PYTHON=python
fi

# Create virtual environment if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON -m venv venv
fi

# Activate venv (handle both Windows and Unix paths)
if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

pip install -r requirements.txt -q

# Start the launcher
echo "Starting launcher service on http://localhost:8080"
$PYTHON -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
