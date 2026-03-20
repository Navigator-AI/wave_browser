# Wave Browser - Architecture Document

## Overview

A web application for browsing RTL design hierarchy and viewing waveforms from any simulator in a browser. The system uses a generic API layer that can be adapted to different design/wave database formats (FSDB/KDB, VCD, etc.).

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Browser)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   Hierarchy Panel   │  │   Waveform Viewer   │  │   Signal Search     │  │
│  │   - Tree View       │  │   - Canvas/WebGL    │  │   - Fuzzy Match     │  │
│  │   - Scope Navigation│  │   - Zoom/Pan        │  │   - Filters         │  │
│  │   - Signal List     │  │   - Time Cursors    │  │   - History         │  │
│  └─────────────────────┘  │   - Value Display   │  └─────────────────────┘  │
│                           └─────────────────────┘                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Generic API Client Layer                          ││
│  │  - REST/WebSocket interface to backend                                   ││
│  │  - Response caching & prefetching                                        ││
│  │  - Pagination for large datasets                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                               HTTP/WebSocket
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Python)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Generic API Layer (FastAPI)                      ││
│  │  Endpoints:                                                              ││
│  │  - GET /api/sessions              - List open database sessions          ││
│  │  - POST /api/sessions             - Open new design/wave database        ││
│  │  - DELETE /api/sessions/{id}      - Close database session               ││
│  │  - GET /api/sessions/{id}/info    - Get database metadata                ││
│  │  │                                                                       ││
│  │  - GET /api/hierarchy/scopes      - Get top-level scopes                 ││
│  │  - GET /api/hierarchy/scopes/{path}/children - Get child scopes          ││
│  │  - GET /api/hierarchy/scopes/{path}/signals  - Get signals in scope      ││
│  │  │                                                                       ││
│  │  - GET /api/signals/{path}        - Get signal properties                ││
│  │  - GET /api/signals/{path}/waveform - Get waveform data (time range)     ││
│  │  │                                                                       ││
│  │  - POST /api/search/signals       - Search signals by pattern            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      │                                       │
│                           Vendor Adapter Interface                           │
│                                      │                                       │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐ │
│  │  Verdi NPI Adapter    │  │   VCD Adapter         │  │  Future Adapters │ │
│  │  - pynpi.waveform     │  │   - pyvcd            │  │  - Questa        │ │
│  │  - pynpi.netlist      │  │   - vcd parser       │  │  - Riviera       │ │
│  │  - FSDB/KDB support   │  │   - VCD format       │  │  - etc.          │ │
│  └───────────────────────┘  └───────────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Generic API Data Models

### Session
```json
{
  "id": "uuid",
  "vendor": "verdi",
  "design_db": "/path/to/design.kdb",
  "wave_db": "/path/to/waves.fsdb",
  "time_unit": "ns",
  "min_time": 0,
  "max_time": 1000000,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Scope
```json
{
  "path": "top.cpu.alu",
  "name": "alu",
  "type": "module",
  "def_name": "ALU",
  "has_children": true,
  "has_signals": true
}
```

### Signal
```json
{
  "path": "top.cpu.alu.result",
  "name": "result",
  "type": "logic",
  "width": 32,
  "left_range": 31,
  "right_range": 0,
  "direction": "output",
  "is_real": false,
  "is_array": false
}
```

### Waveform Data
```json
{
  "signal_path": "top.cpu.alu.result",
  "time_unit": "ns",
  "start_time": 0,
  "end_time": 1000,
  "changes": [
    {"time": 0, "value": "00000000"},
    {"time": 100, "value": "00001111"},
    {"time": 200, "value": "11110000"}
  ]
}
```

## Technology Stack

### Frontend
- **Framework**: React with TypeScript
- **Waveform Rendering**: HTML Canvas or WebGL (consider libraries like `d3.js` for timeline)
- **State Management**: React Context or Zustand
- **UI Components**: shadcn/ui or Ant Design
- **Build Tool**: Vite

### Backend
- **Framework**: FastAPI (Python) - asynchronous, fast, good OpenAPI support
- **NPI Integration**: pynpi Python bindings
- **Async Tasks**: asyncio for non-blocking operations
- **Caching**: Redis or in-memory LRU cache for waveform data
- **API Documentation**: Auto-generated OpenAPI/Swagger

### Environment Requirements
- `VERDI_HOME` must be set
- `LD_LIBRARY_PATH` must include `$VERDI_HOME/share/NPI/lib/linux64` and `$VERDI_HOME/platform/linux64/bin`
- Python path must include `$VERDI_HOME/share/NPI/python`

## NPI Usage Patterns

### Opening Databases
```python
from pynpi import npisys, waveform

# Initialize NPI
npisys.init([])

# Open FSDB file
file_handle = waveform.open("/path/to/design.fsdb")

# Get file info
info = waveform.FileHdl(file_handle)
min_time = info.min_time()
max_time = info.max_time()
```

### Hierarchy Traversal
```python
from pynpi import waveform

# Get top-level scopes
for scope in waveform.FileHdl(file_handle).top_scope_list():
    print(scope.full_name())
    
# Get child scopes
for child in scope.child_scope_list():
    print(child.full_name())

# Get signals in scope
for sig in scope.sig_list():
    print(sig.full_name(), sig.left_range(), sig.right_range())
```

### Reading Waveform Data
```python
from pynpi import waveform

# Get signal handle
sig = waveform.sig_by_name(file_handle, "top.clk", None)

# Create VCT (value change table) iterator
vct = waveform.create_vct(sig)

# Navigate through changes
waveform.goto_first(vct)
while True:
    time = waveform.vct_time(vct)
    value = waveform.get_value_str(vct, waveform.HexStrVal, waveform.VCT, 0)
    print(f"Time: {time}, Value: {value}")
    if not waveform.goto_next(vct):
        break

waveform.release_vct(vct)
```

### Time-Based Iteration (Efficient for Multiple Signals)
```python
from pynpi import waveform

# Create time-based iterator
iter = waveform.TimeBasedVcIter()
iter.add(sig1, 0)  # Add signals
iter.add(sig2, 0)
iter.start(start_time, end_time)

while True:
    result = iter.iter_next()
    if result[0] < 0:
        break
    time, sig = result[1], result[2]
    value = iter.get_value_str()
    
iter.iter_stop()
```

## Agent-Based Development Strategy

### Recommended Agent Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR AGENT                              │
│  - Coordinates other agents                                          │
│  - Maintains project context and dependencies                        │
│  - Reviews integration points between frontend/backend               │
└─────────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────────────────────┐
│ BACKEND AGENT │  │FRONTEND AGENT │  │    NPI INTEGRATION AGENT      │
└───────────────┘  └───────────────┘  └───────────────────────────────┘
```

### 1. NPI Integration Agent

**Purpose**: Build and test the vendor adapter layer for Verdi NPI.

**Tasks**:
1. Create `backend/adapters/verdi_adapter.py` - Wrapper around pynpi
2. Define abstract base class `BaseAdapter` for future vendor support
3. Handle NPI initialization/shutdown properly
4. Implement efficient caching for hierarchy data
5. Write unit tests with mock FSDB files

**Key Deliverables**:
```
backend/
├── adapters/
│   ├── __init__.py
│   ├── base.py              # Abstract base adapter
│   ├── verdi_adapter.py     # Verdi NPI implementation
│   └── models.py            # Pydantic models for adapter data
├── tests/
│   └── test_verdi_adapter.py
```

### 2. Backend Agent

**Purpose**: Build the FastAPI backend with generic API layer.

**Tasks**:
1. Set up FastAPI project structure
2. Define Pydantic models for API requests/responses
3. Implement REST endpoints for hierarchy browsing
4. Implement REST endpoints for waveform data retrieval
5. Add WebSocket support for real-time updates (optional)
6. Implement session management for multiple open databases
7. Add caching layer for performance
8. Write API tests

**Key Deliverables**:
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Configuration management
│   ├── models/
│   │   ├── __init__.py
│   │   ├── session.py       # Session models
│   │   ├── hierarchy.py     # Hierarchy models
│   │   └── waveform.py      # Waveform models
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── sessions.py      # Session management endpoints
│   │   ├── hierarchy.py     # Hierarchy browsing endpoints
│   │   └── waveform.py      # Waveform data endpoints
│   ├── services/
│   │   ├── __init__.py
│   │   └── session_manager.py
│   └── dependencies.py
├── requirements.txt
└── Dockerfile
```

### 3. Frontend Agent

**Purpose**: Build the React-based frontend application.

**Tasks**:
1. Set up React + TypeScript + Vite project
2. Create API client layer with type-safe interfaces
3. Build hierarchy tree component with lazy loading
4. Build waveform viewer with canvas rendering
5. Implement signal search with fuzzy matching
6. Add zoom/pan controls and time cursor
7. Implement value display at cursor position
8. Style with modern UI components

**Key Deliverables**:
```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts        # API client
│   │   └── types.ts         # TypeScript types matching backend
│   ├── components/
│   │   ├── HierarchyPanel/
│   │   │   ├── HierarchyTree.tsx
│   │   │   ├── SignalList.tsx
│   │   │   └── ScopeNode.tsx
│   │   ├── WaveformViewer/
│   │   │   ├── WaveformCanvas.tsx
│   │   │   ├── TimeAxis.tsx
│   │   │   ├── SignalRow.tsx
│   │   │   └── Cursor.tsx
│   │   └── common/
│   │       ├── SearchInput.tsx
│   │       └── Layout.tsx
│   ├── hooks/
│   │   ├── useHierarchy.ts
│   │   ├── useWaveform.ts
│   │   └── useSession.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

## Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up project structure
- [ ] Implement NPI adapter with basic functionality
- [ ] Create FastAPI skeleton with session management
- [ ] Set up React project with basic routing

### Phase 2: Hierarchy Browsing (Week 2-3)
- [ ] Implement hierarchy API endpoints
- [ ] Build hierarchy tree component
- [ ] Add signal listing within scopes
- [ ] Implement signal search

### Phase 3: Waveform Viewing (Week 3-5)
- [ ] Implement waveform data API
- [ ] Build canvas-based waveform renderer
- [ ] Add time cursor and value display
- [ ] Implement zoom/pan controls

### Phase 4: Polish & Performance (Week 5-6)
- [ ] Add caching and prefetching
- [ ] Optimize large waveform rendering
- [ ] Add keyboard shortcuts
- [ ] Error handling and loading states

## Environment Setup Script

```bash
#!/bin/bash
# setup_env.sh

export VERDI_HOME=/global/apps/verdi_2025.06-SP1-1
export LD_LIBRARY_PATH=$VERDI_HOME/share/NPI/lib/linux64:$VERDI_HOME/platform/linux64/bin:$LD_LIBRARY_PATH
export PYTHONPATH=$VERDI_HOME/share/NPI/python:$PYTHONPATH

# Verify NPI is accessible
python3 -c "from pynpi import npisys; print('NPI OK')"
```

## Running the Application

```bash
# Terminal 1: Backend
cd backend
source setup_env.sh
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

## API Examples

```bash
# Open a database session
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"vendor": "verdi", "wave_db": "/path/to/waves.fsdb"}'

# Get hierarchy
curl http://localhost:8000/api/sessions/1/hierarchy/scopes

# Get signals in a scope
curl http://localhost:8000/api/sessions/1/hierarchy/scopes/top.cpu.alu/signals

# Get waveform data
curl "http://localhost:8000/api/sessions/1/signals/top.clk/waveform?start=0&end=1000"
```
