# Exact SSH Commands for Production WebSocket Fix

## Step 1: SSH and Locate File
```bash
# SSH into your server (you have the credentials)
ssh root@your-production-server

# Find the production file
find / -name "prod-server-v2.cjs" -type f 2>/dev/null
# Usually in: /etc/easypanel/projects/sharezidi_v2/app7_services/code/
```

## Step 2: Make Backup and Edit
```bash
# Navigate to the directory
cd /path/to/your/app/directory

# Backup original
cp prod-server-v2.cjs prod-server-v2.cjs.backup

# Use sed for quick fixes or nano for manual editing
```

## Step 3: Apply WebSocket Fixes

### Option A: Quick sed commands
```bash
# Fix 1: Change registration message type
sed -i "s/'registration-confirmed'/'registered'/g" prod-server-v2.cjs

# Fix 2: Wrap userId in data object  
sed -i "s/userId: userId,/data: { userId: userId }/g" prod-server-v2.cjs

# Fix 3: Remove deviceName from registration message
sed -i "s/deviceName: deviceName//g" prod-server-v2.cjs

# Fix 4: Add data wrapper to device list
sed -i "s/{ type: 'devices', devices }/{ type: 'devices', data: devices }/g" prod-server-v2.cjs
```

### Option B: Manual editing with nano
```bash
nano prod-server-v2.cjs

# Find line ~638 and change:
type: 'registration-confirmed' → type: 'registered'
userId: userId, deviceName: deviceName → data: { userId: userId }

# Find line ~784 and change:
{ type: 'devices', devices } → { type: 'devices', data: devices }
```

## Step 4: Restart Server
```bash
# Check current process
ps aux | grep prod-server-v2.cjs

# Kill existing process
pkill -f "prod-server-v2.cjs"

# Start new process
nohup node prod-server-v2.cjs > server.log 2>&1 &

# Or if using PM2:
pm2 restart all
```

## Step 5: Verify Fix
```bash
# Check if running
ps aux | grep prod-server-v2.cjs

# Check logs
tail -f server.log
```

These commands will fix the WebSocket message format issues directly on production.