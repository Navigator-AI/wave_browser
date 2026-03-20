# Development Scripts for Wave Browser

## Running Modes

### Frontend with Mocks (No Backend Needed)
```powershell
.\scripts\dev-frontend-mock.ps1
```
Opens http://localhost:5173 with MSW mocking all API calls.

### Backend Only
```powershell
.\scripts\dev-backend.ps1
```
Starts backend on http://localhost:8000

### Full Integration (Run Both)
```powershell
# Terminal 1: Start backend
.\scripts\dev-backend.ps1

# Terminal 2: Start frontend
.\scripts\dev-frontend.ps1
```
Then open: http://localhost:5173?server=localhost:8000

### Remote Backend

```bash
# On remote machine (e.g., avidanus01)
cd ~/wave_browser/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then open from your local browser:
```
http://localhost:5173?server=avidanus01:8000&fsdb=/path/to/file.fsdb
```

## URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `server` | Backend host:port | `server=avidanus01:8000` |
| `fsdb` | FSDB file path to open | `fsdb=/home/user/sim/dump.fsdb` |

### Examples
- Demo mode (no params): `http://localhost:5173`
- Connect to remote: `http://localhost:5173?server=avidanus01:8000`
- Connect and open file: `http://localhost:5173?server=avidanus01:8000&fsdb=/home/user/dump.fsdb`
