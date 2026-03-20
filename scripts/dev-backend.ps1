# Start backend server
# The backend must have access to waveform database files

param(
    [string]$Host = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$Reload
)

$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot\..\backend

try {
    # Check for venv
    if (-not (Test-Path "venv")) {
        Write-Host "Creating virtual environment..." -ForegroundColor Yellow
        python -m venv venv
        .\venv\Scripts\pip install -r requirements.txt
    }
    
    Write-Host "Starting backend server..." -ForegroundColor Cyan
    Write-Host "URL: http://${Host}:${Port}" -ForegroundColor Green
    Write-Host "Docs: http://${Host}:${Port}/docs" -ForegroundColor Green
    Write-Host ""
    
    $reloadArg = if ($Reload) { "--reload" } else { "" }
    
    & .\venv\Scripts\python -m uvicorn app.main:app --host $Host --port $Port $reloadArg
}
finally {
    Pop-Location
}
