# Wave Browser Logging System

This document describes the logging system implemented in the Wave Browser application for debugging, monitoring, and troubleshooting.

## Overview

The logging system provides structured logging for both the backend (Python/FastAPI) and frontend (TypeScript/React) with the following features:

- **Colored console output** for easy reading during development
- **JSON-formatted file logs** for production analysis
- **Request/response logging** with timing information
- **Error tracking** with stack traces
- **Configurable log levels**

---

## Backend Logging

### Configuration

Backend logging is configured in `backend/app/logging_config.py` and can be controlled via environment variables or the `backend/app/config.py` settings.

#### Settings

| Setting | Environment Variable | Default | Description |
|---------|---------------------|---------|-------------|
| `log_level` | `WAVE_BROWSER_LOG_LEVEL` | `INFO` | Minimum log level: DEBUG, INFO, WARNING, ERROR |
| `log_to_file` | `WAVE_BROWSER_LOG_TO_FILE` | `true` | Enable file logging |

#### Log Files

Log files are stored in `backend/logs/` with daily rotation:
- `wave_browser_YYYYMMDD.log` - JSON-formatted logs

### Log Categories

| Logger Name | Purpose |
|-------------|---------|
| `wave_browser.api` | HTTP request/response logging |
| `wave_browser.session` | Session management operations |
| `wave_browser.npi` | NPI adapter operations (FSDB/KDB) |

### Usage

```python
from app.logging_config import get_logger

logger = get_logger(__name__)

# Log messages at different levels
logger.debug("Detailed debug info", extra={"data": value})
logger.info("Normal operation")
logger.warning("Something unexpected")
logger.error("Error occurred", exc_info=True)  # Includes stack trace
```

### Request Logging Middleware

All HTTP requests are automatically logged by the `RequestLoggingMiddleware`:

```
2026-02-28 08:30:15 | INFO | wave_browser.api | [a1b2c3d4] → POST /api/sessions
2026-02-28 08:30:15 | INFO | wave_browser.api | [a1b2c3d4] ← 201 (125.3ms)
```

Each request gets a unique `request_id` (shown in brackets) that is also returned in the `X-Request-ID` response header for correlation.

### Log Format

#### Console (Colored)
```
YYYY-MM-DD HH:MM:SS | LEVEL | logger.name | Message
```

#### JSON File
```json
{
  "timestamp": "2026-02-28T08:30:15.123456Z",
  "level": "INFO",
  "logger": "wave_browser.session",
  "message": "Session created successfully",
  "request_id": "a1b2c3d4",
  "session_id": "uuid-here"
}
```

---

## Frontend Logging

### Configuration

Frontend logging is configured in `frontend/src/utils/logging.ts`.

#### Setting Log Level

```typescript
import { setLogLevel } from './utils/logging';

// In development, enable debug logs
setLogLevel('debug');

// In production, only errors
setLogLevel('error');
```

### Log Categories

| Logger | Purpose |
|--------|---------|
| `App` | General application logs |
| `API` | HTTP API requests/responses |
| `Session` | Session management |
| `Hierarchy` | Design hierarchy operations |
| `Waveform` | Waveform data operations |

### Usage

```typescript
import { createLogger, logger, apiLogger } from './utils/logging';

// Use default logger
logger.info('Application started');
logger.error('Something went wrong', error);

// Use category-specific loggers
apiLogger.debug('Fetching data', { url: '/api/...' });

// Create custom logger
const myLogger = createLogger('MyComponent');
myLogger.info('Component mounted');
```

### Log Output

Browser console with color-coded output:
```
[2026-02-28 08:30:15.123] [INFO] [Session] Opening database
[2026-02-28 08:30:15.456] [DEBUG] [API] POST /api/sessions
[2026-02-28 08:30:15.789] [INFO] [Session] Session created successfully
```

### Log History

Recent logs are stored in memory and can be retrieved:

```typescript
import { getLogHistory, clearLogHistory } from './utils/logging';

// Get last 100 log entries
const logs = getLogHistory();
console.table(logs);

// Clear history
clearLogHistory();
```

---

## Debugging Guide

### Common Issues

#### "Unknown error" in frontend

1. Open browser DevTools → Console
2. Look for `[API]` category logs
3. Check the `error` object for details
4. Find the `X-Request-ID` header and search backend logs

#### KDB/FSDB Load Failures

1. Check backend logs for `wave_browser.npi` entries
2. Look for `load_design` return value
3. Verify file paths exist and are readable

#### CORS Errors

1. Check browser DevTools → Network tab
2. Verify `Access-Control-Allow-Origin` headers
3. Ensure frontend URL is in `cors_origins` config

### Enabling Debug Logging

#### Backend
```bash
export WAVE_BROWSER_LOG_LEVEL=DEBUG
# Restart the server
```

#### Frontend
```typescript
// In browser console
import('./utils/logging').then(m => m.setLogLevel('debug'));
```

### Log Correlation

To trace a request through the system:

1. Note the `X-Request-ID` from browser Network tab or console
2. Search backend logs: `grep "a1b2c3d4" backend/logs/*.log`
3. All related log entries will have the same request_id

---

## Monitoring

### Viewing Live Logs

**Backend:**
```bash
# Watch log file
tail -f backend/logs/wave_browser_$(date +%Y%m%d).log | jq .

# Filter by level
tail -f backend/logs/*.log | jq 'select(.level == "ERROR")'
```

**Frontend:**
- Browser DevTools → Console (filter by category)

### Error Alerts

Critical errors are logged with `level: "ERROR"` and include full stack traces in the `exception` field. Set up log monitoring (e.g., with `journalctl`, Elasticsearch, or similar) to alert on these.

---

## Performance

- Console logging has minimal overhead
- File logging uses buffered I/O
- Frontend log history limited to 100 entries
- Consider reducing log level in production for high-traffic scenarios
