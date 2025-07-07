#!/bin/bash
set -e

echo "🔧 Building ShareZidi for production..."

# 1. Build frontend with Vite
echo "📦 Building frontend..."
npx vite build --outDir=dist/public

# 2. Copy simple production server
echo "🖥️ Setting up production server..."
cp server/simple-prod-server.js dist/prod-server.js

# 3. Verify build
echo "✅ Build verification..."
if [ -f "dist/public/index.html" ] && [ -f "dist/prod-server.js" ]; then
    echo "✅ Frontend: Built successfully"
    echo "✅ Backend: Production server ready"
    echo "✅ Build completed successfully!"
    
    # Show build size
    echo "📊 Build size:"
    du -h dist/public/ | tail -1
    ls -lh dist/prod-server.js
else
    echo "❌ Build failed - missing files"
    exit 1
fi

echo "🚀 Ready for deployment!"