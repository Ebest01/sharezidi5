# Quick start command - Fixed version without $pid conflict
$processId = (Get-NetTCPConnection -LocalPort 8003 -State Listen -ErrorAction SilentlyContinue).OwningProcess; if ($processId) { Stop-Process -Id $processId -Force }; Start-Sleep -Seconds 2; cd "C:\Users\Erick MK\Documents\projs\sharezidi\sharezidi7B\sharezidi-v3-python"; Start-Process python -ArgumentList "debug_server.py" -WindowStyle Hidden; Start-Sleep -Seconds 5; (Invoke-WebRequest -Uri "http://localhost:8003/test55" -UseBasicParsing).StatusCode

