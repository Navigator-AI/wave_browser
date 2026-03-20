#!/bin/bash
# Alternative: Compile with Verdi's vericom + verilog for design database
# Use this if you don't have VCS license

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RTL_DIR="$SCRIPT_DIR/rtl"
SIM_DIR="$SCRIPT_DIR/sim"

mkdir -p "$SIM_DIR"
cd "$SIM_DIR"

echo "========================================="
echo "Creating KDB with Verdi vericom..."
echo "========================================="

# Create library mapping
cat > synopsys_sim.setup << 'EOF'
WORK > DEFAULT
DEFAULT : ./work
EOF

mkdir -p work

# Compile design to KDB using Verdi's built-in compiler
# -sverilog: Enable SystemVerilog support
# -lib work: Output to work library
vericom -sverilog \
    -lib work \
    "$RTL_DIR/counter.v" \
    "$RTL_DIR/tb_counter.v" \
    2>&1 | tee compile.log

echo ""
echo "========================================="
echo "KDB created!"
echo "========================================="
echo ""
echo "Generated:"
echo "  KDB: $SIM_DIR/work"
echo ""
echo "Note: To get FSDB, you need to run simulation with a simulator"
echo "that supports \$fsdbDumpfile (VCS, NC-Verilog, etc.)"
