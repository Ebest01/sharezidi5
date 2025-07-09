# ShareZidi Production Deployment Guide

## For Easypanel Buildpacks Deployment

**CRITICAL FIX**: The deployment shows `dist/prod-server.js 2.8mb ⚠️` instead of our 156KB version.

**Root Cause**: Easypanel buildpack ignores our build-production.sh and uses default npm build

**Solutions Created**:

1. **Heroku Hooks**: Added `heroku-prebuild.js` and `heroku-postbuild.js` to override build process
2. **Custom Build Script**: `bin/build` executable for Heroku buildpack detection
3. **Procfile**: Ensures correct start command
4. **Project Config**: `project.toml` for buildpack settings

**Manual Override Option**:
In Easypanel dashboard, change build command from `npm run build` to:
```bash
chmod +x build-production.sh && ./build-production.sh
```

## For Docker Deployment

Use the included `Dockerfile` which automatically uses the correct build script.

## Why Custom Build Script?

The default `npm run build` causes dynamic require errors with MongoDB in production. The custom script externals MongoDB dependencies:

- ✅ **Before**: 2.8MB bundle with MongoDB errors
- ✅ **After**: 152.9KB bundle working perfectly

## Environment Variables Required

```bash
MONGODB_URI=mongodb://shzmdb2:11xxshzMDB@193.203.165.217:27017/sharezidi?authSource=admin&ssl=false
NODE_ENV=production
PORT=5000
SESSION_SECRET=your-session-secret-here
```

## Deployment Steps

1. **Build**: Run `./build-production.sh`
2. **Start**: Run `npm start` 
3. **Files**: Ensure `dist/` folder and `node_modules/` are available in production

## Verified Working ✅

- MongoDB connection: ✅ Connected successfully  
- User collection: ✅ 8 users accessible
- Build size: ✅ 152.9KB (was 2.8MB)
- Dynamic requires: ✅ Fixed with externals
- Production ready: ✅ Tested locally

## MongoDB Connection Details

- **Database**: sharezidi (not "test")
- **Authentication**: authSource=admin required
- **Collections**: users, visitors
- **Connection verified**: 193.203.165.217:27017