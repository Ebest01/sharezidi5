# ShareZidi Buildpacks Deployment Guide

## Why Buildpacks > Dockerfile
You were absolutely right to switch to Buildpacks. For Node.js applications on Easypanel:
- Buildpacks automatically detect and configure the environment
- No complex Docker configuration needed
- Handles dependencies and build process automatically
- More reliable for standard Node.js deployments

## Current Package.json Scripts
Based on your setup, Buildpacks will automatically:
1. Run `npm install` (dependencies)
2. Run `npm run build` (build process)
3. Run `npm start` (production server)

## For Buildpacks Success
Make sure these scripts work correctly in package.json:
```json
{
  "scripts": {
    "build": "vite build client && npx esbuild server/prod-server.ts --bundle --platform=node --format=esm --outfile=dist/server.js --external:ws --external:express",
    "start": "NODE_ENV=production node dist/server.js"
  }
}
```

## Environment Variables for Easypanel
- PORT (automatically set by platform)
- NODE_ENV=production
- DATABASE_URL (if using database)

## Health Check Endpoint
Your app should respond at `/health` for monitoring.

Buildpacks handle everything automatically - much simpler than Docker!