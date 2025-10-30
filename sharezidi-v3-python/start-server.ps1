# ShareZidi Debug Server Startup Script
# This script kills any process using port 8003, starts the debug server, and tests it

$port = 8003
$scriptDir = "C:\Users\Erick MK\Documents\projs\sharezidi\sharezidi7B\sharezidi-v3-python"
$testUrl = "http://localhost:$port/test55"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ShareZidi Debug Server Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill any process using port 8003
Write-Host "Checking for processes on port $port..." -ForegroundColor Yellow
$processId = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess

if ($processId) {
    Write-Host "Found process $processId using port $port. Stopping..." -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "Process stopped." -ForegroundColor Green
} else {
    Write-Host "No process found on port $port." -ForegroundColor Green
}

Write-Host ""

# Step 2: Navigate to script directory
Write-Host "Navigating to: $scriptDir" -ForegroundColor Yellow
Set-Location $scriptDir

# Step 3: Start the server in background
Write-Host "Starting debug_server.py..." -ForegroundColor Yellow
$process = Start-Process python -ArgumentList "debug_server.py" -WindowStyle Hidden -PassThru

Write-Host "Server started (PID: $($process.Id))" -ForegroundColor Green
Write-Host "Waiting 5 seconds for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Step 4: Test the server
Write-Host ""
Write-Host "Testing server at $testUrl..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -TimeoutSec 10
    Write-Host "✓ Server is running!" -ForegroundColor Green
    Write-Host "  Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Server URLs:" -ForegroundColor Cyan
    Write-Host "  Test Page (NO CACHE):  http://localhost:$port/test55" -ForegroundColor White
    Write-Host "  Test Page 2:            http://localhost:$port/test2" -ForegroundColor White
    Write-Host "  Stats:                  http://localhost:$port/stats" -ForegroundColor White
    Write-Host ""
    Write-Host "Server Process ID: $($process.Id)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To stop the server, run:" -ForegroundColor Yellow
    Write-Host "  Stop-Process -Id $($process.Id) -Force" -ForegroundColor White
} catch {
    Write-Host "✗ Server test failed!" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "The server may still be starting. Try accessing:" -ForegroundColor Yellow
    Write-Host "  $testUrl" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

