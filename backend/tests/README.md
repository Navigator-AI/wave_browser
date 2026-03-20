# Backend Tests

This directory contains tests for the Wave Browser backend.

## Running Tests

### Unit Tests (with mocks, no real FSDB needed)

```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

### Integration Tests (requires real FSDB)

```bash
cd ../example
source ../setup_env.sh
python test_backend_standalone.py sim/waves.fsdb
```

## Test Coverage

- `test_api_mock.py` - Tests all API endpoints using mocked NPI adapter
  - Session management (create, list, close)
  - Hierarchy browsing (scopes, signals, search)
  - Waveform data (get waveform, value at time, batch)
