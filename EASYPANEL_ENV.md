# Easypanel Environment Variables

Set these environment variables in your ShareZidi app service:

## Database Configuration
```
DATABASE_URL=postgresql://sharexzidix_user:YOUR_PASSWORD@sharezidi_db:5432/sharexzidix
```

## Authentication
```
SESSION_SECRET=your_secure_random_session_secret_here
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

## Application
```
NODE_ENV=production
PORT=5000
```

## Steps to Configure:

1. **Get Database Connection:**
   - Go to your `sharezidi_db` service in Easypanel
   - Copy the internal connection string
   - Replace the database name with `sharexzidix`
   - Replace the username with `sharexzidix_user`

2. **Generate Session Secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Google OAuth Setup:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials
   - Add your domain to authorized origins
   - Add `/api/auth/google/callback` to redirect URIs

4. **Set Environment Variables:**
   - Go to your ShareZidi app service
   - Navigate to Environment tab
   - Add all variables above

5. **Deploy Database Schema:**
   After setting DATABASE_URL, the app will automatically create tables on first run.