# Example Design and Testing

This directory contains a simple RTL design for testing Wave Browser.

## Design Hierarchy

```
tb_counter (testbench)
└── dut : counter_top
    ├── clk, rst_n, start        (inputs)
    ├── count_out[7:0], done     (outputs)
    ├── running                   (internal reg)
    └── u_counter : counter
        ├── clk, rst_n, enable   (inputs)
        ├── count[7:0], overflow (outputs)
        ├── next_count[7:0]      (internal wire)
        └── overflow_reg         (internal reg)
```

## Step 1: Generate FSDB and KDB

### Option A: Using VCS (recommended)

```bash
chmod +x run_sim.sh
./run_sim.sh
```

This will:
1. Compile RTL with VCS (generates KDB)
2. Run simulation (generates FSDB)

Output files:
- `sim/waves.fsdb` - Waveform database
- `sim/simv.daidir/kdb.elab++` - Design database

### Option B: Using Verdi vericom (no simulation)

```bash
chmod +x run_vericom.sh
./run_vericom.sh
```

This creates KDB only (no FSDB without simulation).

## Step 2: Test Backend Standalone

Test NPI adapter directly without starting web server:

```bash
# Setup environment
source ../setup_env.sh

# Test with RTL source files directly (no pre-compilation needed!)
$PYTHON_CMD test_backend_standalone.py --design-only --design-db "rtl/counter.v rtl/tb_counter.v"

# Or specify RTL directory
$PYTHON_CMD test_backend_standalone.py --design-only --design-db rtl

# Full test with FSDB and KDB (if generated)
$PYTHON_CMD test_backend_standalone.py sim/waves.fsdb sim/simv.daidir/kdb.elab++

# FSDB only
$PYTHON_CMD test_backend_standalone.py sim/waves.fsdb
```

Expected output:
```
============================================================
Wave Browser - Backend Standalone Test
============================================================
Wave DB:   sim/waves.fsdb
Design DB: sim/simv.daidir/kdb.elab++

DATABASE INFO:
{
  "file_path": "sim/waves.fsdb",
  "time_unit": "ns",
  "min_time": 0,
  "max_time": 30000,
  ...
}

TOP-LEVEL SCOPES:
  tb_counter (module)
    has_children: True, has_signals: True
...
```

## Step 3: Test Backend API

Test the FastAPI server with HTTP requests:

```bash
# Terminal 1: Start backend
cd ../backend
source ../setup_env.sh
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2: Run API tests
cd ../example
python test_api.py sim/waves.fsdb sim/simv.daidir/kdb.elab++
```

Or use curl manually:

```bash
# Create session
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"vendor": "verdi", "wave_db": "/full/path/to/sim/waves.fsdb"}'

# Get scopes (use session_id from response above)
curl http://localhost:8000/api/hierarchy/{session_id}/scopes

# Get signals
curl http://localhost:8000/api/hierarchy/{session_id}/scopes/tb_counter/signals

# Get waveform
curl "http://localhost:8000/api/waveform/{session_id}/signals/tb_counter.clk?start=0&end=1000"
```

## Step 4: Run Full Application

```bash
# Terminal 1: Backend
cd ../backend
source ../setup_env.sh
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd ../frontend
npm install
npm run dev
```

Then:
1. Open http://localhost:5173
2. Click "Open Database"
3. Enter paths:
   - Wave DB: `/full/path/to/wave_browser/example/sim/waves.fsdb`
   - Design DB: `/full/path/to/wave_browser/example/sim/simv.daidir/kdb.elab++`
4. Click "Open"
5. Navigate hierarchy in left panel
6. Click signals to add them to waveform viewer

## Troubleshooting

### NPI Import Error
```
ModuleNotFoundError: No module named 'pynpi'
```
Fix: Source the environment setup:
```bash
source ../setup_env.sh
```

### FSDB Not Found
Make sure to use absolute paths when opening databases via the web UI.

### VCS License Error
If VCS is not available, use a pre-existing FSDB file or try the vericom approach for KDB-only testing.

### Backend Connection Error
Make sure the backend is running on port 8000:
```bash
curl http://localhost:8000/health
# Should return: {"status": "healthy"}
```
