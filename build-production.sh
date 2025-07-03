#!/bin/bash

echo "🔨 Building ShareZidi for production..."

# Clean previous build
rm -rf dist
mkdir -p dist

# Build frontend with timeout protection
echo "📦 Building frontend..."
timeout 300 npm run build:frontend || {
    echo "❌ Frontend build timed out or failed"
    echo "🔄 Trying with faster build settings..."
    
    # Fallback: Build with smaller bundle optimization
    VITE_BUILD_TIMEOUT=true npx vite build --minify=false --chunkSizeWarningLimit=2000
}

# Build backend
echo "🖥️  Building backend..."
npx esbuild server/prod-server.ts \
    --platform=node \
    --bundle \
    --format=esm \
    --outdir=dist \
    --external:ws \
    --external:express \
    --external:path \
    --external:fs \
    --external:http \
    --external:os

# Verify build success
if [ -f "dist/prod-server.js" ] && [ -f "dist/public/index.html" ]; then
    echo "✅ Production build completed successfully!"
    echo "📁 Frontend assets: $(ls -la dist/public/ | wc -l) files"
    echo "🎯 Backend server: dist/prod-server.js"
else
    echo "❌ Build verification failed"
    echo "Frontend build: $([ -f 'dist/public/index.html' ] && echo '✅' || echo '❌')"
    echo "Backend build: $([ -f 'dist/prod-server.js' ] && echo '✅' || echo '❌')"
    exit 1
fi

echo "🚀 Ready for deployment with: npm start"