#!/usr/bin/env node

// Heroku prebuild hook to use our custom build script
const { execSync } = require('child_process');
const fs = require('fs');

// Ensure we have the tools we need
process.env.PATH = process.env.PATH + ':/workspace/node_modules/.bin';

console.log('🚀 ShareZidi Heroku Prebuild Hook');
console.log('📝 Overriding default build process...');

try {
  // Make our script executable
  execSync('chmod +x build-production.sh', { stdio: 'inherit' });
  
  // Run our custom build
  console.log('🔧 Running custom MongoDB-external build...');
  execSync('./build-production.sh', { stdio: 'inherit' });
  
  console.log('✅ Custom build completed successfully!');
  
  // Show build results
  const stats = fs.statSync('dist/prod-server.js');
  console.log(`📦 Server bundle size: ${(stats.size / 1024).toFixed(1)}KB`);
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}