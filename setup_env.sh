#!/bin/bash
# Environment setup for Wave Browser
# Source this before running the backend

# Load Python 3.11 module (has pip)
module load python/3.11

export VERDI_HOME=/global/apps/verdi_2025.06-SP1-1
export PATH=$VERDI_HOME/bin:${PATH:-}
export LD_LIBRARY_PATH=$VERDI_HOME/share/NPI/lib/linux64:$VERDI_HOME/platform/linux64/bin:${LD_LIBRARY_PATH:-}

# Get script directory for PYTHONPATH
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH=$SCRIPT_DIR/backend:$VERDI_HOME/share/NPI/python:${PYTHONPATH:-}

# Synopsys License
export SNPSLMD_LICENSE_FILE=26585@us01genlic:26585@us01snpslmd1

# Python command (from module)
export PYTHON_CMD=python

# Verify NPI is accessible
if $PYTHON_CMD -c "from pynpi import npisys; print('NPI initialization: OK')" 2>/dev/null; then
    echo "Environment configured successfully"
    echo "Python: $(python --version)"
else
    echo "WARNING: Could not import pynpi. Check VERDI_HOME and paths."
fi
