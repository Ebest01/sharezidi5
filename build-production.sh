#!/bin/bash

echo "🏗️  Building ShareZidi for production..."

# Clean previous builds
rm -rf dist
rm -rf client/dist

echo "📦 Building frontend..."
# Build frontend only (no server dependencies that might fail)
npx vite build --outDir client/dist --minify false

echo "🖥️  Building server..."
# Build server with simpler options
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
  --external:os \
  --target=es2020

echo "📋 Build summary:"
if [ -f "client/dist/index.html" ]; then
  echo "✅ Frontend built successfully"
  echo "   📁 Frontend files: $(ls client/dist | wc -l) files"
else
  echo "❌ Frontend build failed"
fi

if [ -f "dist/prod-server.js" ]; then
  echo "✅ Server built successfully"
  echo "   📁 Server file: dist/prod-server.js"
else
  echo "❌ Server build failed"
fi

echo "🚀 Build complete! Ready for deployment."
echo "💡 Copy both client/dist and dist/prod-server.js to production"