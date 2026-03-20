# Wave Browser

A web application for browsing RTL design hierarchy and viewing waveforms from any simulator in your browser.

## Features

- **Hierarchy Browser**: Navigate through RTL design hierarchy (modules, instances, interfaces)
- **Signal Search**: Find signals by name with fuzzy matching
- **Waveform Viewer**: View signal waveforms with zoom, pan, and time cursors
- **Vendor Agnostic**: Generic API with pluggable adapters (Verdi FSDB/KDB, VCD, etc.)

## Project Structure

```
wave_browser/
├── backend/           # Python FastAPI backend
│   ├── app/           # Application code
│   └── adapters/      # Vendor-specific adapters
├── frontend/          # React TypeScript frontend
└── docs/              # Documentation
```

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- Access to Verdi installation (for NPI)

### Setup

```bash
# Configure environment for NPI
source setup_env.sh

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
```

### Running

```bash
# Terminal 1: Start backend
cd backend
source ../setup_env.sh
uvicorn app.main:app --reload --port 8000

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### Access

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design documentation.

## Development

### Backend Agent Tasks

The backend agent should focus on:
1. Implementing the NPI adapter layer
2. Building REST API endpoints
3. Managing database sessions
4. Caching for performance

### Frontend Agent Tasks

The frontend agent should focus on:
1. Hierarchy tree component with lazy loading
2. Canvas-based waveform rendering
3. Signal search with autocomplete
4. Responsive layout

## License

Proprietary - Internal Use Only
