#!/bin/bash
# Start the CV Drawing Comparison Service (Linux/Mac)

cd "$(dirname "$0")"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start the service
echo ""
echo "Starting CV Drawing Comparison Service on port 5050..."
echo "Press Ctrl+C to stop."
echo ""
python drawing_compare.py
