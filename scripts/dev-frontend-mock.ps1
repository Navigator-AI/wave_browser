# Start frontend with MSW mocks (no backend needed)
# This is useful for UI development without running the backend

$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot\..\frontend

try {
    Write-Host "Starting frontend with mocks..." -ForegroundColor Cyan
    Write-Host "URL: http://localhost:5173" -ForegroundColor Green
    Write-Host ""
    
    $env:VITE_USE_MOCKS = "true"
    npm run dev
}
finally {
    Pop-Location
}
