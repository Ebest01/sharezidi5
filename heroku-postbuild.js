#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🎯 ShareZidi Heroku Postbuild Hook');
console.log('📁 Copying CommonJS production server...');

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
  console.log('✅ Created dist directory');
}

// Copy CommonJS production server
const sourcePath = path.join(__dirname, 'server', 'prod-server.cjs');
const destPath = path.join(__dirname, 'dist', 'prod-server.cjs');

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, destPath);
  const stats = fs.statSync(destPath);
  console.log(`✅ Copied server/prod-server.cjs to dist/prod-server.cjs (${(stats.size / 1024).toFixed(1)}KB)`);
} else {
  console.error('❌ Source file not found:', sourcePath);
  process.exit(1);
}

console.log('✅ Post-build setup complete - CommonJS server ready!');