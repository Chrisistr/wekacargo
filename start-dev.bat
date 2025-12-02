@echo off
REM WekaCargo Development Startup Script
REM This script starts both backend and frontend servers

echo ================================================
echo      WekaCargo - Starting Development Servers
echo ================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

echo Note: Ensure MongoDB is running (local or Atlas)
echo.

REM Start Backend Server
echo Starting Backend Server...
start "WekaCargo Backend" cmd /k "cd backend && npm run dev"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend Server
echo Starting Frontend Server...
start "WekaCargo Frontend" cmd /k "cd frontend && npm start"

echo.
echo ================================================
echo Servers are starting in separate windows
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo ================================================
pause

