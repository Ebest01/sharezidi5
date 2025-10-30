# ShareZidi Debug Server Stop Script
# This script stops any process running on port 8003

$port = 8003

Write-Host "Stopping server on port $port..." -ForegroundColor Yellow

$processId = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess

if ($processId) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Write-Host "Server stopped (PID: $processId)" -ForegroundColor Green
} else {
    Write-Host "No server found running on port $port" -ForegroundColor Yellow
}

