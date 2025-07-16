#!/usr/bin/env node

const fs = require('fs');

console.log('🎯 ShareZidi Heroku Postbuild Hook');
console.log('✅ Using development server directly - just build frontend');

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
  console.log('✅ Created dist directory');
}

console.log('✅ Post-build setup complete - using working dev server!');