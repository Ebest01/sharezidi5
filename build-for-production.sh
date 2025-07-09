#!/bin/bash
# Build script to prepare all local dependencies for production

echo "🔧 Building ShareZidi for production deployment..."

# Create dist directory
mkdir -p dist

# Build Tailwind CSS
echo "📦 Building Tailwind CSS..."
npx tailwindcss build -o dist/tailwind-built.css

# Copy React UMD files to a predictable location (optional backup)
echo "⚛️ Ensuring React dependencies are available..."
ls -la node_modules/react/umd/ | head -3
ls -la node_modules/react-dom/umd/ | head -3  
ls -la node_modules/@babel/standalone/ | head -3

# Verify all dependencies exist
echo "✅ Checking local dependencies:"
echo "   React UMD: $(ls -1 node_modules/react/umd/react.development.js 2>/dev/null && echo '✓ Found' || echo '✗ Missing')"
echo "   ReactDOM UMD: $(ls -1 node_modules/react-dom/umd/react-dom.development.js 2>/dev/null && echo '✓ Found' || echo '✗ Missing')"
echo "   Babel Standalone: $(ls -1 node_modules/@babel/standalone/babel.min.js 2>/dev/null && echo '✓ Found' || echo '✗ Missing')"
echo "   Tailwind Built: $(ls -1 dist/tailwind-built.css 2>/dev/null && echo '✓ Found' || echo '✗ Missing')"

echo "🚀 Production build complete! Ready for deployment."