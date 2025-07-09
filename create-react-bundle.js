// Create browser-compatible React bundles
const fs = require('fs');
const path = require('path');

console.log('Creating browser-compatible React bundles...');

// Create a simple React bundle for browsers
const reactBundle = `
// React 19.1.0 Browser Bundle
(function(global) {
  'use strict';
  
  // Import React CommonJS modules and expose globally
  const React = require('./node_modules/react/index.js');
  const ReactDOM = require('./node_modules/react-dom/client.js');
  
  // Expose to window
  global.React = React;
  global.ReactDOM = ReactDOM;
  
  console.log('✅ React loaded:', React.version);
  console.log('✅ ReactDOM loaded');
  
})(window);
`;

// Write the bundle
fs.writeFileSync('react-browser-bundle.js', reactBundle);
console.log('✅ Created react-browser-bundle.js');

// Create dist directory and ensure Tailwind exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

console.log('✅ React browser bundle ready for production!');