# Commit Message for GitHub Push

## Title
```
feat: Add admin login bypass system for development

- Username: AxDMIxN 
- Password: AZQ00001xx
- Bypasses email verification for dev/testing
- Auto-creates admin with Pro privileges
- Updated UI to show admin credentials hint
```

## Detailed Description
```
Added development admin authentication system:

✅ Admin Login Bypass
   - Special credentials: AxDMIxN / AZQ00001xx
   - Skips email verification system completely
   - Perfect for development and testing

✅ Auto-Creation
   - Creates admin user automatically on first login
   - Assigns Pro privileges (unlimited transfers)
   - Uses special email: admin@sharezidi.dev

✅ Enhanced UI
   - Login form accepts both email and username
   - Visual hint shows admin credentials for developers
   - Updated form validation to be more flexible

✅ Database Integration
   - Admin user stored with geolocation data
   - Full integration with existing user system
   - Maintains session and authentication flow

Files Modified:
- server/authRoutes.ts: Added admin bypass logic
- client/src/pages/auth-page.tsx: Updated login form
- client/src/main.tsx: Fixed React Query setup
- replit.md: Documented new feature

This enables seamless development without email setup requirements.
```

## Git Commands to Run
```bash
# Check current status
git status

# Add all changes
git add .

# Commit with message
git commit -m "feat: Add admin login bypass system for development

- Username: AxDMIxN / Password: AZQ00001xx
- Bypasses email verification for dev/testing  
- Auto-creates admin with Pro privileges
- Updated UI to show admin credentials hint"

# Push to GitHub
git push origin main
```