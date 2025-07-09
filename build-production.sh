#!/bin/bash

echo "Building ShareZidi production version..."

# Build frontend with Vite
echo "Building frontend..."
vite build

# Build backend with proper externals for MongoDB
echo "Building backend..."
esbuild server/prod-server.ts \
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
  --external:mongodb \
  --external:mongoose \
  --external:crypto \
  --external:util \
  --external:stream \
  --external:bcrypt

echo "Production build complete!"