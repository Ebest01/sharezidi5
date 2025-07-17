#!/usr/bin/env node

// Heroku postbuild script to build frontend and copy to server directory
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Starting ShareZidi build process...');

try {
  // Build the frontend
  console.log('📦 Building frontend with Vite...');
  execSync('npx vite build', { stdio: 'inherit' });
  
  // Copy built files to server/public
  console.log('📂 Copying build files to server/public...');
  const sourceDir = path.join(process.cwd(), 'dist', 'public');
  const targetDir = path.join(process.cwd(), 'server', 'public');
  
  // Create server directory if it doesn't exist
  if (!fs.existsSync(path.join(process.cwd(), 'server'))) {
    fs.mkdirSync(path.join(process.cwd(), 'server'), { recursive: true });
  }
  
  // Copy files
  execSync(`cp -r "${sourceDir}" "${path.dirname(targetDir)}"`, { stdio: 'inherit' });
  
  console.log('✅ Build process completed successfully!');
} catch (error) {
  console.error('❌ Build process failed:', error.message);
  process.exit(1);
}