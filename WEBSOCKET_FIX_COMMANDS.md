# WebSocket Fix Deployment Commands

## Changes Made
- Fixed production server WebSocket message format to match development
- Changed "registration-confirmed" to "registered" message type
- Added proper "data" wrapper for device list broadcasts
- Updated user ID display fallback logic

## Git Commands to Deploy

```bash
# Add all changes
git add -A

# Commit the WebSocket fixes
git commit -m "Fix WebSocket message format consistency between dev and production

- Change registration-confirmed to registered message type
- Add data wrapper for device list broadcasts  
- Fix undefined values in production WebSocket messages
- Update user ID display with proper fallback logic"

# Push to GitHub (triggers Easypanel deployment)
git push origin main
```

## Files Modified
- `client/src/components/ShareZidiApp.tsx` - Updated user ID display fallback
- `prod-server-v2.cjs` - Fixed WebSocket message formats to match development server

## Expected Results After Deployment
- User ID will display correctly in top right corner
- WebSocket messages will no longer show "undefined" values
- Device discovery will work properly between devices
- File transfer functionality will be fully operational

## Test After Deployment
1. Refresh the production app
2. Check that user ID displays correctly 
3. Verify WebSocket connection shows "Connected" status
4. Test device discovery with mobile device