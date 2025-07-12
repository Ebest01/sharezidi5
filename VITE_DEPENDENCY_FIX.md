# 🔧 VITE DEPENDENCY FIX - CRITICAL FOR DEPLOYMENT

## Problem Identified:
`vite` is currently in `devDependencies` but needs to be in `dependencies` for production builds to work.

**Current (line 113):**
```json
"devDependencies": {
  // ...
  "vite": "^5.4.19"
}
```

**Required:**
```json
"dependencies": {
  // ...
  "vite": "^5.4.19"
}
```

## Manual Fix Instructions:

### Option 1: Edit package.json directly on GitHub
1. Go to: https://github.com/Ebest01/sharezidi2/blob/main/package.json
2. Click "Edit this file" (pencil icon)
3. **Move line 113**: Cut `"vite": "^5.4.19"` from devDependencies
4. **Add to dependencies**: Paste after line 90 (after zod-validation-error)
5. Add a comma after zod-validation-error line
6. Commit with message: "Move vite to dependencies for production builds"

### Option 2: Use packager tool (if available)
```bash
npm install vite --save
npm uninstall vite --save-dev
```

### Option 3: Manual terminal commands
```bash
# Create backup
cp package.json package.json.backup

# Use npm to move the package
npm install vite@^5.4.19 --save
npm uninstall vite --save-dev

# Commit the change
git add package.json
git commit -m "Move vite to dependencies for production deployment"
git push origin main
```

## Why This Matters:
- Heroku buildpacks only install `dependencies` in production
- `devDependencies` are skipped to reduce build size
- Without vite in dependencies, the build script fails with "vite: not found"

**This fix + the npx prefix = fully resolved deployment**