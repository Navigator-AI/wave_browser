#!/bin/bash
# Start backend server (for remote Linux machines)
# Usage: ./start-backend.sh [--host 0.0.0.0] [--port 8000] [--reload]

HOST="0.0.0.0"
PORT="8000"
RELOAD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --reload)
            RELOAD="--reload"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

cd "$(dirname "$0")/../backend"

# Create venv if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi

echo "Starting backend server..."
echo "URL: http://${HOST}:${PORT}"
echo "Docs: http://${HOST}:${PORT}/docs"
echo ""

./venv/bin/python -m uvicorn app.main:app --host "$HOST" --port "$PORT" $RELOAD
