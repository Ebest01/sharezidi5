#!/bin/bash

# ShareZidi Deployment Fix - Git Push Script
# Pushes package.json changes that move build tools to dependencies

echo "🔧 ShareZidi Deployment Fix - Git Push"
echo "======================================"

# Remove any git lock files
echo "Clearing git locks..."
rm -f .git/index.lock
rm -f .git/refs/heads/main.lock

# Check git status
echo "Checking git status..."
git status

# Add the critical package.json fix
echo "Adding package.json changes..."
git add package.json

# Show what will be committed
echo "Changes to commit:"
git diff --staged --name-only

# Commit with detailed message
echo "Committing deployment fix..."
git commit -m "CRITICAL: Move build dependencies to main dependencies for production

- Moved vite from devDependencies to dependencies
- Moved esbuild, typescript, tailwindcss to dependencies  
- Moved @vitejs/plugin-react to dependencies
- Moved autoprefixer, postcss to dependencies
- Moved @tailwindcss/vite to dependencies
- Moved Replit plugins to dependencies

This fixes 'vite: not found' deployment errors on Heroku/Easypanel
which only install dependencies (not devDependencies) in production.

Build script already has npx prefix: 
'npx vite build && npx esbuild...'

Configuration matches successfully deployed version."

# Push to GitHub
echo "Pushing to GitHub repository..."
git push origin main

# Confirm success
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS: Deployment fix pushed to GitHub!"
    echo ""
    echo "📦 Changes applied:"
    echo "   • vite moved to dependencies"
    echo "   • esbuild moved to dependencies"  
    echo "   • typescript moved to dependencies"
    echo "   • tailwindcss moved to dependencies"
    echo "   • All build tools now in main dependencies"
    echo ""
    echo "🚀 Ready for deployment:"
    echo "   • Package.json matches working production version"
    echo "   • Build script has npx prefix"
    echo "   • Heroku/Easypanel will find all build tools"
    echo ""
    echo "Next: Deploy via Easypanel - this will work!"
else
    echo ""
    echo "❌ ERROR: Git push failed"
    echo "Check the error messages above and try again"
    echo ""
    echo "Manual backup commands:"
    echo "git add package.json"
    echo "git commit -m 'Move build deps to dependencies'"
    echo "git push origin main"
fi