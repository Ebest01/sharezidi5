# SSH Commands to Fix ShareZidi Production Build

## Connect to Production Server:
```bash
ssh root@193.203.165.217
```

## Once Connected, Run These Commands:

### Step 1: Find and Navigate to ShareZidi Project
```bash
# Find the project directory
find /root -name "package.json" -path "*/sharezidi*" 2>/dev/null

# OR check common deployment paths:
ls -la /root/
cd sharezidi* 
# OR
cd /opt/easypanel/projects/sharezidi_v2/app7_services/
```

### Step 2: Backup and Fix package.json
```bash
# Backup current package.json
cp package.json package.json.backup

# Fix the build script (add npx prefix)
sed -i 's/"build": "vite build/"build": "npx vite build/g' package.json

# Verify the change
grep '"build":' package.json
```

### Step 3: Alternative Manual Edit (if sed doesn't work)
```bash
# Open with nano editor
nano package.json

# Find this line:
"build": "vite build && esbuild server/prod-server.ts..."

# Change to:
"build": "npx vite build && npx esbuild server/prod-server.ts..."

# Save: Ctrl+O, Enter, Ctrl+X
```

### Step 4: Restart Production Service
```bash
# If using PM2
pm2 restart sharezidi

# OR if using systemd
systemctl restart sharezidi

# OR restart Docker container if containerized
docker restart sharezidi_container
```

## Expected Fix:
This changes the build command from:
```json
"build": "vite build && esbuild server/prod-server.ts..."
```

To:
```json
"build": "npx vite build && npx esbuild server/prod-server.ts..."
```

The `npx` prefix ensures the tools are found during deployment build process.

## After Fix:
1. Re-deploy from Easypanel dashboard
2. Build should complete successfully
3. Accessibility features will be live in production