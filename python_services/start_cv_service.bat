@echo off
REM Start the CV Drawing Comparison Service (Windows)

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found. Please install Python 3.8+ and add to PATH.
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install/update dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Start the service
echo.
echo Starting CV Drawing Comparison Service on port 5050...
echo Press Ctrl+C to stop.
echo.
python drawing_compare.py
