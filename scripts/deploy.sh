#!/bin/bash

# Wave Browser Deployment Script
# Deploys Wave Browser on a Linux server with systemd services

set -e

echo "=================================="
echo "Wave Browser Deployment Script"
echo "=================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "⚠️  This script must be run as root (use: sudo ./deploy.sh)"
   exit 1
fi

PROJECT_DIR="/projects/sujayak/wave_browser"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    print_error "Python 3 not found. Install Python 3.10+"
    exit 1
fi
print_status "Python 3 found"

if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Install Node.js 18+"
    exit 1
fi
print_status "Node.js found"

if ! command -v npm &> /dev/null; then
    print_error "npm not found"
    exit 1
fi
print_status "npm found"

# Create wavebrowser user if doesn't exist
echo ""
echo "Setting up system user..."

if id -u wavebrowser &>/dev/null 2>&1; then
    print_status "User 'wavebrowser' already exists"
else
    useradd -r -s /bin/bash wavebrowser
    print_status "Created user 'wavebrowser'"
fi

# Set ownership
chown -R wavebrowser:wavebrowser "$PROJECT_DIR"
print_status "Set ownership to wavebrowser user"

# Setup backend
echo ""
echo "Setting up backend..."

cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

print_info "Installing Python dependencies..."
pip install --upgrade pip setuptools wheel > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1

print_status "Backend dependencies installed"

deactivate

# Setup frontend
echo ""
echo "Setting up frontend..."

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    print_info "Installing npm dependencies..."
    npm install > /dev/null 2>&1
fi

print_info "Building frontend..."
npm run build > /dev/null 2>&1

print_status "Frontend built"

# Setup systemd services
echo ""
echo "Setting up systemd services..."

# Copy service files
cp "$PROJECT_DIR/systemd/waveform-viewer-api.service" /etc/systemd/system/
cp "$PROJECT_DIR/systemd/waveform-viewer-web.service" /etc/systemd/system/

print_status "Service files installed"

# Reload systemd
systemctl daemon-reload
print_status "Systemd daemon reloaded"

# Enable services
systemctl enable waveform-viewer-api.service > /dev/null 2>&1
systemctl enable waveform-viewer-web.service > /dev/null 2>&1
print_status "Services enabled for auto-start"

# Start services
echo ""
echo "Starting services..."

systemctl start waveform-viewer-api.service
sleep 2
print_status "Backend API started (8802)"

systemctl start waveform-viewer-web.service
sleep 2
print_status "Frontend web server started (5317)"

# Verify services
echo ""
echo "Verifying services..."

if systemctl is-active --quiet waveform-viewer-api.service; then
    print_status "Backend API is running"
else
    print_error "Backend API failed to start"
    echo "Logs:"
    journalctl -u waveform-viewer-api.service -n 10
fi

if systemctl is-active --quiet waveform-viewer-web.service; then
    print_status "Frontend web server is running"
else
    print_error "Frontend web server failed to start"
    echo "Logs:"
    journalctl -u waveform-viewer-web.service -n 10
fi

# Get server IP
echo ""
echo "Deployment complete! 🎉"
echo ""

# Try to get local IP
SERVER_IP=$(hostname -I | awk '{print $1}')

if [ -z "$SERVER_IP" ]; then
    SERVER_IP="<server-ip>"
fi

echo "=================================="
echo "Access Wave Browser"
echo "=================================="
echo ""
print_info "Open in browser:"
echo "  http://$SERVER_IP:5317?server=$SERVER_IP:8802"
echo ""
print_info "Or access locally:"
echo "  http://localhost:5317?server=localhost:8802"
echo ""
print_info "API Documentation:"
echo "  http://$SERVER_IP:8802/docs"
echo ""

echo "=================================="
echo "Service Management Commands"
echo "=================================="
echo ""
echo "View status:"
echo "  sudo systemctl status waveform-viewer-api.service"
echo "  sudo systemctl status waveform-viewer-web.service"
echo ""
echo "View logs:"
echo "  sudo journalctl -u waveform-viewer-api.service -f"
echo "  sudo journalctl -u waveform-viewer-web.service -f"
echo ""
echo "Restart services:"
echo "  sudo systemctl restart waveform-viewer-api.service"
echo "  sudo systemctl restart waveform-viewer-web.service"
echo ""
echo "Stop services:"
echo "  sudo systemctl stop waveform-viewer-api.service"
echo "  sudo systemctl stop waveform-viewer-web.service"
echo ""

echo "For more info, see: $PROJECT_DIR/docs/DEPLOYMENT.md"
