#!/bin/bash
# Compile and run simulation with VCS, generate FSDB and KDB
# Usage: ./run_sim.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RTL_DIR="$SCRIPT_DIR/rtl"
SIM_DIR="$SCRIPT_DIR/sim"

# Create simulation directory
mkdir -p "$SIM_DIR"
cd "$SIM_DIR"

echo "========================================="
echo "Compiling RTL with VCS..."
echo "========================================="

# Compile with VCS
# -kdb: Generate KDB design database
# -debug_access+all: Enable full debug access for FSDB dumping
# -sverilog: Enable SystemVerilog
vcs -full64 \
    -kdb \
    -debug_access+all \
    -sverilog \
    -timescale=1ns/1ps \
    -o simv \
    "$RTL_DIR/counter.v" \
    "$RTL_DIR/tb_counter.v" \
    2>&1 | tee compile.log

echo ""
echo "========================================="
echo "Running simulation..."
echo "========================================="

# Run simulation
./simv 2>&1 | tee sim.log

echo ""
echo "========================================="
echo "Simulation complete!"
echo "========================================="
echo ""
echo "Generated files:"
echo "  KDB (design): $SIM_DIR/simv.daidir/kdb.elab++"
echo "  FSDB (waves): $SIM_DIR/waves.fsdb"
echo ""
echo "To view in Verdi:"
echo "  verdi -ssf $SIM_DIR/simv.daidir -sswr $SIM_DIR/waves.fsdb"
echo ""
echo "To use with Wave Browser:"
echo "  wave_db: $SIM_DIR/waves.fsdb"
echo "  design_db: $SIM_DIR/simv.daidir/kdb.elab++"
