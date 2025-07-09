#!/usr/bin/env node

// Heroku postbuild hook - skip default npm build
console.log('🎯 ShareZidi Heroku Postbuild Hook');
console.log('✅ Custom build already completed in prebuild phase');
console.log('📋 Skipping default npm build to prevent MongoDB bundling');

// Verify our build exists
const fs = require('fs');
if (fs.existsSync('dist/prod-server.js')) {
  const stats = fs.statSync('dist/prod-server.js');
  console.log(`✅ Server bundle ready: ${(stats.size / 1024).toFixed(1)}KB`);
} else {
  console.error('❌ Build failed - server bundle not found');
  process.exit(1);
}