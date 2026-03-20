# Wave Browser Frontend - Development Context

This document provides all context needed to develop the frontend independently from the backend.

## Project Overview

Wave Browser is a web application for browsing RTL (Register-Transfer Level) design hierarchy and viewing waveforms. It connects to a backend that interfaces with Synopsys Verdi's NPI (Native Programming Interface) to access FSDB waveform files and KDB design databases.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Sessions │  │ Hierarchy  │  │  Waveform   │  │   State    │ │
│  │  Dialog  │  │   Panel    │  │   Viewer    │  │  (Zustand) │ │
│  └──────────┘  └────────────┘  └─────────────┘  └────────────┘ │
│                          │                                      │
│                    TanStack Query                               │
│                          │                                      │
│                     API Client                                  │
└─────────────────────────│───────────────────────────────────────┘
                          │ REST API
┌─────────────────────────│───────────────────────────────────────┐
│                    Backend (FastAPI)                            │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │   Sessions   │  │   Hierarchy    │  │     Waveform       │  │
│  │    Router    │  │     Router     │  │      Router        │  │
│  └──────────────┘  └────────────────┘  └────────────────────┘  │
│                          │                                      │
│                   Session Manager                               │
│                          │                                      │
│                    Verdi Adapter (NPI)                          │
└─────────────────────────│───────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
         FSDB Files            KDB/RTL Files
        (Waveforms)        (Design Hierarchy)
```

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **lucide-react** - Icons

### Backend (Linux only)
- **Python 3.11** - Runtime
- **FastAPI** - API framework
- **pynpi** - Synopsys NPI bindings

## Directory Structure

```
frontend/
├── src/
│   ├── api/                    # API client and types
│   │   ├── client.ts           # HTTP client with logging
│   │   ├── types.ts            # TypeScript interfaces (matches backend models)
│   │   └── index.ts            # Exports
│   ├── components/
│   │   ├── SessionDialog.tsx   # Open database dialog
│   │   ├── HierarchyPanel/     # Design hierarchy tree
│   │   └── WaveformPanel/      # Waveform viewer (placeholder)
│   ├── store/
│   │   └── waveformStore.ts    # Zustand state
│   ├── utils/
│   │   └── logging.ts          # Frontend logging utility
│   ├── App.tsx                 # Main component
│   ├── main.tsx                # Entry point
│   └── index.css               # Tailwind imports
├── mocks/                      # Mock server for standalone testing
│   ├── server.ts               # MSW mock server setup
│   ├── handlers.ts             # API mock handlers
│   └── data.ts                 # Mock data fixtures
├── e2e/                        # End-to-end tests (Playwright)
│   └── ...
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## API Specification

Base URL: `http://localhost:8000/api` (backend) or mocked locally

### Sessions API

#### List Sessions
```http
GET /sessions
```
Response:
```json
{
  "sessions": [
    {
      "id": "uuid",
      "vendor": "verdi",
      "wave_db": "/path/to/file.fsdb" | null,
      "design_db": "/path/to/rtl files",
      "time_unit": "ns",
      "min_time": 0,
      "max_time": 100000,
      "is_completed": true,
      "created_at": "2026-02-28T12:00:00"
    }
  ]
}
```

#### Create Session
```http
POST /sessions
Content-Type: application/json

{
  "vendor": "verdi",
  "wave_db": "/path/to/file.fsdb",  // optional
  "design_db": "/path/to/design"     // optional, at least one required
}
```
Response (201):
```json
{
  "session": { /* SessionInfo */ }
}
```

#### Get Session
```http
GET /sessions/{session_id}
```

#### Delete Session
```http
DELETE /sessions/{session_id}
```
Response: 204 No Content

---

### Hierarchy API

#### Get Top-Level Scopes
```http
GET /hierarchy/{session_id}/scopes
```
Response:
```json
{
  "scopes": [
    {
      "name": "tb_counter",
      "path": "tb_counter",
      "def_name": "tb_counter",
      "scope_type": "module",
      "has_children": true,
      "has_signals": true
    }
  ]
}
```

#### Get Child Scopes
```http
GET /hierarchy/{session_id}/scopes/{scope_path}/children
```
Response: Same as above

#### Get Signals in Scope
```http
GET /hierarchy/{session_id}/scopes/{scope_path}/signals
```
Response:
```json
{
  "signals": [
    {
      "name": "clk",
      "path": "tb_counter.clk",
      "width": 1,
      "direction": "none",
      "left_range": 0,
      "right_range": 0,
      "is_array": false,
      "is_composite": false,
      "is_real": false,
      "has_members": false
    }
  ]
}
```

#### Search Signals
```http
POST /hierarchy/{session_id}/signals/search
Content-Type: application/json

{
  "pattern": "*clk*",
  "limit": 100
}
```

---

### Waveform API

#### Get Waveform Data
```http
GET /waveform/{session_id}/signals/{signal_path}?start=0&end=1000&max_changes=10000
```
Response:
```json
{
  "signal_path": "tb_counter.clk",
  "time_unit": "ns",
  "start_time": 0,
  "end_time": 1000,
  "changes": [
    {"time": 0, "value": "0"},
    {"time": 5, "value": "1"},
    {"time": 10, "value": "0"}
  ]
}
```

#### Batch Waveforms
```http
POST /waveform/{session_id}/batch
Content-Type: application/json

{
  "signals": ["tb.clk", "tb.rst_n"],
  "start_time": 0,
  "end_time": 1000,
  "max_changes": 10000
}
```

#### Get Value at Time
```http
GET /waveform/{session_id}/value/{signal_path}?time=500
```
Response:
```json
{
  "signal_path": "tb_counter.clk",
  "time": 500,
  "value": "1"
}
```

---

## TypeScript Interfaces

See `src/api/types.ts` for complete type definitions. Key interfaces:

```typescript
interface SessionInfo {
  id: string;
  vendor: string;
  wave_db?: string;
  design_db?: string;
  time_unit: string;
  min_time: number;
  max_time: number;
  is_completed: boolean;
  created_at: string;
}

interface ScopeInfo {
  name: string;
  path: string;
  def_name: string;
  scope_type: string;
  has_children: boolean;
  has_signals: boolean;
}

interface SignalInfo {
  name: string;
  path: string;
  width: number;
  direction: string;
  left_range: number;
  right_range: number;
  is_array: boolean;
  is_composite: boolean;
  is_real: boolean;
  has_members: boolean;
}

interface ValueChange {
  time: number;
  value: string;
}
```

---

## State Management

### Zustand Store (`src/store/waveformStore.ts`)

```typescript
interface WaveformState {
  // Session
  currentSession: SessionInfo | null;
  setCurrentSession: (session: SessionInfo | null) => void;
  
  // Selection
  selectedScope: string | null;
  selectScope: (path: string | null) => void;
  
  // Waveform viewer
  selectedSignals: string[];
  addSignal: (path: string) => void;
  removeSignal: (path: string) => void;
  clearSignals: () => void;
  
  // Time navigation
  currentTime: number;
  timeRange: [number, number];
  setCurrentTime: (time: number) => void;
  setTimeRange: (range: [number, number]) => void;
}
```

---

## Current Implementation Status

### Completed ✅
- Session dialog with default KDB path
- Session creation/listing API client
- Hierarchy browsing (top scopes, children, signals)
- Signal search
- API request/response logging
- Error display in UI

### In Progress 🚧
- Hierarchy tree component (basic structure)
- Waveform panel (placeholder)

### Not Started ❌
- Waveform rendering (Canvas/WebGL)
- Value display panel
- Time cursor
- Zoom/pan controls
- Signal drag-and-drop
- Keyboard shortcuts

---

## Mock Server Usage

The mock server uses [MSW (Mock Service Worker)](https://mswjs.io/) to intercept API requests.

### Running with Mocks
```bash
npm run dev:mock
```

### Running with Real Backend
```bash
npm run dev
```
Requires backend running on `http://localhost:8000`

---

## E2E Testing with Playwright

### Run Tests
```bash
npm run test:e2e
```

### Run Tests with UI
```bash
npm run test:e2e:ui
```

---

## Development Workflow

### On Windows (Frontend)
1. Open `frontend/` folder in VS Code
2. Run `npm install`
3. Run `npm run dev:mock` for standalone development
4. Run `npm run test:e2e` to test UI

### On Linux (Backend)
1. Source environment: `source setup_env.sh`
2. Start backend: `cd backend && python -m uvicorn app.main:app --reload`

### Integration Testing
1. Point frontend to Linux backend IP in `vite.config.ts`:
   ```ts
   proxy: {
     '/api': {
       target: 'http://LINUX_IP:8000',
       changeOrigin: true,
     }
   }
   ```
