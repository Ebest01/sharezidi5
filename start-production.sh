#!/bin/bash
set -e

echo "Starting ShareZidi production server..."

# Kill any existing processes
pkill -f "dist/prod-server.js" 2>/dev/null || true
sleep 2

# Verify build exists
if [ ! -f "dist/prod-server.js" ]; then
    echo "Error: dist/prod-server.js not found. Run 'npm run build' first."
    exit 1
fi

# Start server with proper error handling
exec node dist/prod-server.js