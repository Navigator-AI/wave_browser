#!/bin/bash
# Wave Browser Development Launcher
# Starts frontend, backend, and it.cyou tunnels

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/.run-logs"

echo "============================================"
echo "  Wave Browser Development Launcher"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    pkill -f "vite" || true
    pkill -f "uvicorn" || true
    pkill -f "itcyou" || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if it.cyou is authenticated
if ! itcyou auth status 2>/dev/null | grep -q "authenticated"; then
    echo "Authenticating with it.cyou..."
    itcyou auth itc_afa1960e581c4ad9262ed8b902da6785 <<< "y"
fi

# Start backend
echo -e "${GREEN}Starting backend on port 8800...${NC}"
cd "$PROJECT_DIR/backend"
if [ ! -d "venv" ]; then
    python3.11 -m venv venv
fi
mkdir -p "$LOG_DIR"
source venv/bin/activate
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8800 > "$LOG_DIR/waveform-backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
sleep 3

# Start frontend
echo -e "${GREEN}Starting frontend on port 5317...${NC}"
cd "$PROJECT_DIR/frontend"
nohup npm run dev > "$LOG_DIR/waveform-frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

# Wait for frontend to be ready
sleep 5

# Start it.cyou tunnels
echo -e "${GREEN}Starting it.cyou tunnels...${NC}"

# Backend tunnel
nohup itcyou 8800 -s waveformviewer -t itc_afa1960e581c4ad9262ed8b902da6785 > "$LOG_DIR/itcyou-backend.log" 2>&1 &
echo "Backend tunnel: https://waveformviewer.it.cyou"

# Frontend tunnel
nohup itcyou 5317 -s waveformviewerweb -t itc_afa1960e581c4ad9262ed8b902da6785 > "$LOG_DIR/itcyou-frontend.log" 2>&1 &
echo "Frontend tunnel: https://waveformviewerweb.it.cyou"

echo ""
echo "============================================"
echo "  All services started!"
echo "============================================"
echo ""
echo "Access your app at:"
echo "  https://waveformviewerweb.it.cyou?server=waveformviewer.it.cyou"
echo ""
echo "Logs:"
echo "  Backend:   tail -f $LOG_DIR/waveform-backend.log"
echo "  Frontend:  tail -f $LOG_DIR/waveform-frontend.log"
echo "  it.cyou:   tail -f $LOG_DIR/itcyou-*.log"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait indefinitely
wait
