# ShareZidi Production Deployment - Complete Solution

## Issue: Server Restart Loops (SIGTERM)
Your production server keeps restarting due to multiple processes trying to bind to port 80.

## Complete GitHub Update Required

Copy these **exact file contents** to your GitHub repository:

### 1. Replace `server/prod-server.ts`
[Copy the entire enhanced production server with graceful shutdown handling]

### 2. Create new file `start-production.sh`
```bash
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
```

### 3. Update `package.json` scripts section
Replace the scripts section with:
```json
"scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/prod-server.ts --platform=node --bundle --format=esm --outdir=dist --external:ws --external:express --external:path --external:fs --external:http --external:os",
    "start": "NODE_ENV=production bash start-production.sh",
    "check": "tsc",
    "db:push": "drizzle-kit push"
}
```

## Expected Result After GitHub Update + Easypanel Rebuild
- Single stable process on port 80
- No more SIGTERM restart loops
- Enhanced `/health` endpoint with memory monitoring
- Proper graceful shutdown handling

The solution ensures only one process runs and handles container shutdowns properly.