# Wave Browser

Wave Browser is a web app for opening waveform databases, browsing RTL hierarchy, and viewing signal waveforms in the browser.

## What It Does

- Open VCD or FSDB sessions
- Upload one or more Verilog design files (`.v`, `.sv`) and run simulation
- Auto-convert legacy FSDB dump calls to VCD-compatible flow during simulation
- Explore scope/signal hierarchy, waveform timeline, and source code

## Project Layout

- `backend/`: FastAPI API server (default port `8802`)
- `frontend/`: React app (default port `5317`)
- `scripts/run-all.sh`: Starts backend, frontend, and public tunnels
- `scripts/start-backend.sh`: Backend startup helper
- `docs/STARTUP_8802_5317.md`: Detailed local startup guide

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm

## Quick Start (Localhost)

Start backend:

```bash
cd backend
./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8802
```

If `venv` does not exist yet:

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

Start frontend (new terminal):

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5317
```

Open:

```text
http://127.0.0.1:5317?server=127.0.0.1:8802
```

## Public Access (Mobile/Remote)

Use the launcher script that starts backend, frontend, and `it.cyou` tunnels:

```bash
./scripts/run-all.sh
```

Important:

- Use the exact URL printed by the script under `Access your app at:`
- Tunnel hostnames can rotate (for example `...web1.it.cyou` instead of `...web.it.cyou`)
- Always copy the current printed URL, do not rely on old bookmarked tunnel URLs

## Typical User Flow

1. Open the app URL
2. Connect to backend (via `?server=...` URL param)
3. Click `Open`
4. Upload waveform file (`.vcd`, `.fsdb`) or Verilog files (`.v`, `.sv`)
5. For RTL uploads, click `Run Simulation`
6. Inspect waveform timeline and hierarchy

## URL Parameters

- `server`: backend endpoint
	- Host/port style: `?server=localhost:8802`
	- Full URL style: `?server=https://your-backend-domain`
- `fsdb`: optional file path to auto-open on load

Examples:

```text
http://localhost:5317?server=localhost:8802
https://frontend.example.com?server=https://backend.example.com
```

## Troubleshooting

### Frontend shows connection error

- Confirm backend is running:

```bash
curl http://127.0.0.1:8802/health
```

- Confirm frontend is running:

```bash
curl http://127.0.0.1:5317
```

- Ensure `server` query param points to the correct backend.

### Public URL returns 502 or CORS errors

- Restart all processes cleanly:

```bash
pkill -f itcyou || true
pkill -f "uvicorn app.main:app" || true
pkill -f "vite" || true
./scripts/run-all.sh
```

- Use the freshly printed access URL from script output.

### Port already in use

```bash
lsof -i :8802
lsof -i :5317
```

## Development

Backend tests:

```bash
cd backend
pytest
```

Frontend build:

```bash
cd frontend
npm run build
```

Frontend E2E tests:

```bash
cd frontend
npx playwright test
```

## Documentation

- Startup details: `docs/STARTUP_8802_5317.md`
- Architecture: `ARCHITECTURE.md`

