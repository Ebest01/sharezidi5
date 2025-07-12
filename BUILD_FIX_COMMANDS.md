# Quick Fix for Deployment Build Issues

## Problem
The build process is failing because package.json expects server/prod-server.ts but we're using prod-server-v2.cjs

## Solution Options

### Option 1: Use Procfile (Recommended - Fastest)
Since Procfile already points to the correct file, just commit and push:

```bash
git add -A
git commit -m "Fix WebSocket message format consistency between dev and production"
git push origin main
```

**Note**: Easypanel should respect the Procfile and skip the problematic build script.

### Option 2: Use Alternative Build Command
If Option 1 doesn't work, try setting a custom build command in Easypanel:

1. Go to Easypanel → Your App → Settings → Build
2. Change Build Command to: `vite build --outDir=dist/public`
3. Change Start Command to: `node prod-server-v2.cjs`

### Option 3: Use Direct File Copy
If the esbuild is causing issues, we can use a simpler approach:

```bash
# Create a simple build script that just copies files
mkdir -p dist
cp prod-server-v2.cjs dist/
npm run build:client  # Just build the frontend
```

## What I Fixed
- Fixed WebSocket message format in prod-server-v2.cjs:
  - Changed "registration-confirmed" → "registered" 
  - Added proper "data" wrapper for device lists
  - Fixed undefined values in WebSocket messages
- Updated client fallback for user ID display

## Expected Result
Once deployed, the WebSocket communication will work properly with no "undefined" values.