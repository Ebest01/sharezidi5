#!/bin/bash

echo "🚀 Building ShareZidi with MongoDB (Simple Mode)"

# Create simple package.json for production
cat > package.json << 'EOF'
{
  "name": "sharezidi-mongo",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "server.cjs",
  "scripts": {
    "start": "node server.cjs",
    "build": "echo 'MongoDB build complete'"
  },
  "dependencies": {
    "express": "^4.19.2",
    "mongodb": "^6.3.0",
    "ws": "^8.18.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
EOF

# Copy MongoDB server as main server
cp server-mongo.cjs server.cjs

echo "✅ Simple MongoDB build complete"
echo "📋 Start command: node server.cjs"
echo "🔗 MongoDB URI: mongodb://szmdb_user:1!!!!!...Magics4321@sharezidi_v2_sharezidi_mdb:27017/sharezidi"