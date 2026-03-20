# Start frontend (connect to real backend)
# Use URL params to specify backend: ?server=host:port&fsdb=/path/to/file.fsdb

$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot\..\frontend

try {
    Write-Host "Starting frontend..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To connect to a backend, add URL parameters:" -ForegroundColor Yellow
    Write-Host "  http://localhost:5173?server=localhost:8000" -ForegroundColor White
    Write-Host "  http://localhost:5173?server=remotehost:8000&fsdb=/path/to/file.fsdb" -ForegroundColor White
    Write-Host ""
    
    # Disable mocks for real backend connection
    $env:VITE_USE_MOCKS = "false"
    npm run dev
}
finally {
    Pop-Location
}
