# Direct Production Server WebSocket Fix via SSH

## SSH into Your Production Server
```bash
# SSH into your Easypanel/Hostinger VPS
ssh root@your-server-ip
# or
ssh your-username@your-server-ip

# Navigate to your app directory (usually something like)
cd /etc/easypanel/projects/sharezidi_v2/app7_services/code/
# or find it with
find / -name "prod-server-v2.cjs" 2>/dev/null
```

## Make the WebSocket Fixes Directly

### Fix 1: Change registration message format
```bash
# Backup the original file first
cp prod-server-v2.cjs prod-server-v2.cjs.backup

# Edit the registration message (around line 635-641)
sed -i 's/registration-confirmed/registered/g' prod-server-v2.cjs
sed -i 's/userId: userId,/data: { userId: userId }/g' prod-server-v2.cjs
sed -i 's/deviceName: deviceName//g' prod-server-v2.cjs
```

### Fix 2: Update device list broadcast format (around line 784)
```bash
# Replace the device list format
sed -i 's/{ type: '\''devices'\'', devices }/{ type: '\''devices'\'', data: devices }/g' prod-server-v2.cjs
```

### Alternative: Use nano/vi to edit manually
```bash
nano prod-server-v2.cjs

# Find these sections and change:

# Line ~638: Change from:
#   ws.send(JSON.stringify({
#     type: 'registration-confirmed',
#     userId: userId,
#     deviceName: deviceName
#   }));
# To:
#   ws.send(JSON.stringify({
#     type: 'registered',
#     data: { userId: userId }
#   }));

# Line ~784: Change from:
#   const message = JSON.stringify({ type: 'devices', devices });
# To:
#   const message = JSON.stringify({ type: 'devices', data: devices });
```

## Restart the Production Server
```bash
# Find the process
pm2 list
# or
ps aux | grep node

# Restart using PM2 (if using PM2)
pm2 restart sharezidi
# or restart all
pm2 restart all

# Or kill and restart manually
pkill -f "prod-server-v2.cjs"
nohup node prod-server-v2.cjs &
```

## Verify the Fix
```bash
# Check if server is running
ps aux | grep prod-server-v2.cjs

# Check logs
tail -f /var/log/your-app.log
# or if using PM2
pm2 logs sharezidi
```

## Test the Changes
1. Open your production app in browser
2. Check browser console for WebSocket messages
3. Verify user ID displays correctly in top right
4. Test device discovery between two devices

This direct approach bypasses all build issues and applies the WebSocket fixes immediately.