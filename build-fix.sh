#!/bin/bash

# Build fix script for ShareZidi deployment
# This script ensures proper build process for production deployment

echo "ShareZidi Build Fix Script"
echo "=========================="

# Install dependencies first
echo "Installing dependencies..."
npm install

# Build frontend with explicit npx
echo "Building frontend..."
npx vite build

# Build backend with explicit npx 
echo "Building backend..."
npx esbuild server/prod-server.ts --platform=node --bundle --format=esm --outdir=dist --external:ws --external:express --external:path --external:fs --external:http --external:os

echo "Build completed successfully!"
echo "Files ready for production deployment."