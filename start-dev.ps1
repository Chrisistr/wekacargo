# Start API (port from backend/.env, default 5001) then the React app.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Starting backend..."
Start-Process powershell -WorkingDirectory "$root\backend" -ArgumentList "-NoExit", "-Command", "node server.js"
Start-Sleep -Seconds 3
Set-Location "$root\frontend"
Write-Host "Starting frontend (npm start)..."
npm start
