#!/bin/bash
# Start the frontend development server

# Load modules
source /global/etc/modules/3.1.6/init/bash
module load node/18.19.1

# Go to frontend directory
cd /u/avidan/workspaces/wave_browser/frontend

# Start Vite dev server
exec npm run dev -- --host 0.0.0.0
