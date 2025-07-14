#!/bin/bash
echo "Building frontend..."
npx vite build

echo "Copying CommonJS production server..."
mkdir -p dist
cp server/prod-server.cjs dist/prod-server.cjs

echo "✅ Production build complete!"
echo "Frontend: dist/public/"
echo "Server: dist/prod-server.cjs"
