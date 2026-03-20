# Agent Development Guide

This document describes how to use AI agents to continue building and enhancing the Wave Browser application.

## Agent Architecture

The Wave Browser development can be parallelized using three specialized agents, coordinated by an orchestrator:

```
                    ┌─────────────────────┐
                    │  ORCHESTRATOR AGENT │
                    │  (You/User)         │
                    └─────────┬───────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  BACKEND AGENT  │  │ FRONTEND AGENT  │  │   NPI AGENT     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Agent Prompts

### 1. NPI Integration Agent

Use this prompt when you need to extend or fix the NPI adapter layer:

```
You are an expert in Synopsys Verdi NPI (Novas Programming Interface) and Python.

CONTEXT:
- Working on the Wave Browser project at /u/avidan/workspaces/wave_browser
- The NPI adapter is at backend/adapters/verdi_adapter.py
- NPI documentation is at /global/apps/verdi_2025.06-SP1-1/share/NPI
- Python bindings are in $VERDI_HOME/share/NPI/python/pynpi

CAPABILITIES OF NPI:
- pynpi.waveform / pynpi.wave: Read FSDB waveform files
  - wave.open(path): Open FSDB file
  - wave.iter_top_scope(file), wave.iter_sig(scope): Iterate hierarchy
  - wave.create_vct(sig), wave.goto_time(vct, t), wave.goto_next(vct): Read values
  - wave.TimeBasedVcIter: Efficient multi-signal iteration
  
- pynpi.netlist: Read KDB design databases
  - netlist.get_inst(name), netlist.get_port(name), netlist.get_net(name)
  - netlist.hier_tree_trv(): Traverse hierarchy with callbacks
  - InstHdl, PinHdl, NetHdl classes for different object types

CURRENT TASK:
[Describe the specific NPI-related task]

REQUIREMENTS:
1. Test any code changes with actual FSDB/KDB files
2. Handle errors gracefully (missing signals, time ranges, etc.)
3. Maintain the BaseAdapter interface for vendor abstraction
4. Document any new NPI API usage patterns discovered
```

### 2. Backend Agent

Use this prompt for FastAPI backend development:

```
You are an expert Python backend developer specializing in FastAPI.

CONTEXT:
- Working on the Wave Browser project at /u/avidan/workspaces/wave_browser
- Backend is in backend/app/
- Main entry: backend/app/main.py
- Models: backend/app/models.py
- Routers: backend/app/routers/
- Services: backend/app/services/

ARCHITECTURE:
- FastAPI REST API serving generic waveform/hierarchy data
- Session-based database access (multiple users can have different databases open)
- Adapter pattern for vendor abstraction (backend/adapters/)

API ENDPOINTS:
- POST /api/sessions - Open database
- GET /api/hierarchy/{session_id}/scopes - Get hierarchy
- GET /api/waveform/{session_id}/signals/{path} - Get waveform data

CURRENT TASK:
[Describe the specific backend task]

REQUIREMENTS:
1. Maintain type safety with Pydantic models
2. Use async where beneficial
3. Add appropriate error handling with HTTPException
4. Keep API responses consistent with existing patterns
5. Update OpenAPI documentation as needed
```

### 3. Frontend Agent

Use this prompt for React/TypeScript frontend development:

```
You are an expert React/TypeScript developer with experience in data visualization.

CONTEXT:
- Working on the Wave Browser project at /u/avidan/workspaces/wave_browser
- Frontend is in frontend/src/
- Using React 18, TypeScript, Tailwind CSS, TanStack Query, Zustand
- Components: frontend/src/components/
- API client: frontend/src/api/
- State store: frontend/src/store/

KEY COMPONENTS:
- HierarchyPanel: Tree view of design hierarchy, signal list
- WaveformViewer: Canvas-based waveform rendering
- SessionDialog: Database opening dialog

STATE MANAGEMENT:
- useWaveformStore (Zustand): Session, displayed signals, view range, cursor

CURRENT TASK:
[Describe the specific frontend task]

REQUIREMENTS:
1. Use TypeScript strictly (no `any` types)
2. Follow existing component patterns
3. Use TanStack Query for API calls
4. Maintain responsive design
5. Handle loading and error states
```

## Development Workflows

### Adding a New Waveform Feature

1. **NPI Agent**: Ensure adapter supports the needed data access
2. **Backend Agent**: Add/modify API endpoint
3. **Frontend Agent**: Add UI component and data fetching

Example task sequence:
```
NPI Agent: "Add support for reading assertion signals from FSDB"
Backend Agent: "Add GET /api/waveform/{id}/assertions endpoint"
Frontend Agent: "Add assertions panel to WaveformViewer"
```

### Adding Support for a New Database Format

1. **NPI Agent**: Create new adapter (e.g., `vcd_adapter.py`)
2. **Backend Agent**: Register adapter in factory, test endpoints
3. **Frontend Agent**: Add vendor option to SessionDialog

### Improving Waveform Rendering

1. **Frontend Agent**: "Improve waveform canvas rendering for bus signals"
2. **Frontend Agent**: "Add value labels on waveform transitions"
3. **Frontend Agent**: "Implement drag-to-select time range"

## Useful Agent Commands

### Debug NPI Issues
```
Agent Task: "Read the pynpi waveform module documentation and show me how to:
1. Get all value changes for a signal between time T1 and T2
2. Handle composite/struct signals
3. Read signal value as different formats (bin, hex, dec)"

Search in: /global/apps/verdi_2025.06-SP1-1/share/NPI/python/pynpi/waveform.py
Also check: /global/apps/verdi_2025.06-SP1-1/share/NPI/inc/npi_fsdb.h
```

### Add API Endpoint
```
Agent Task: "Add an endpoint to get signal metadata including:
- Signal type (reg, wire, logic)
- Array dimensions if applicable
- Associated clock domain (if available in FSDB)

Update both backend/app/models.py and backend/app/routers/hierarchy.py"
```

### Improve UI Component
```
Agent Task: "Enhance the WaveformCanvas component to:
1. Show hexadecimal values on bus signals
2. Color-code based on signal type
3. Support multi-bit waveform display (bus view vs bit expansion)"
```

## Testing Agents

### Backend Testing
```bash
cd backend
source ../setup_env.sh
pytest tests/ -v
```

### Frontend Testing
```bash
cd frontend
npm test
```

### Integration Testing
```
Agent Task: "Create an integration test that:
1. Opens a test FSDB file
2. Navigates to a specific scope
3. Adds signals to the waveform viewer
4. Verifies waveform data is loaded correctly"
```

## Common Issues and Solutions

### NPI Import Errors
```
Error: ModuleNotFoundError: No module named 'pynpi'

Solution: Ensure environment is set up:
source setup_env.sh
```

### FSDB File Access
```
Error: Failed to open wave database

Check:
1. File path is correct and accessible
2. FSDB file is not corrupted
3. Verdi license is available
```

### API Response Size
```
Issue: Large waveform responses causing performance issues

Solution: 
1. Use pagination (max_changes parameter)
2. Implement lazy loading in frontend
3. Use WebSocket for streaming large datasets
```

## Future Enhancement Ideas

1. **WebSocket Support**: Real-time waveform updates for live simulation
2. **Annotation Layer**: Add markers, labels, bookmarks to waveforms
3. **Comparison View**: Compare two waveforms side-by-side
4. **Export**: Export waveform images or data to various formats
5. **Schematic View**: Show logic gates from KDB design database
6. **Transaction View**: Support for transaction-level waveforms
7. **Multi-User**: Collaborative viewing with shared cursors
