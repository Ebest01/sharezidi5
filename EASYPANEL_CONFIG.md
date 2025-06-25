# Easypanel Configuration Settings

## After Saving Dockerfile:

### 1. Environment Variables
Set these in the Environment tab:
```
DATABASE_URL=postgresql://username:password@host:port/database
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
SESSION_SECRET=your_secure_random_session_secret
NODE_ENV=production
PORT=5000
```

### 2. Port Configuration
- **Container Port**: 5000
- **Public Port**: 80 (or 443 for HTTPS)

### 3. Health Check
Already configured in Dockerfile:
- Endpoint: `/health`
- Interval: 30 seconds
- Timeout: 3 seconds

### 4. Domain Setup
- Add your custom domain
- Enable SSL (Let's Encrypt)
- Force HTTPS redirect

### 5. Create Database Service
Before deploying:
1. Add new service → Database → PostgreSQL
2. Set database name: `sharezidi_db`
3. Note connection details for DATABASE_URL

### 6. Deploy Order
1. Create PostgreSQL service first
2. Get database connection string
3. Add to app service environment variables
4. Deploy app service

Your ShareZidi app will be live with:
- Real-time file transfers
- Mobile wake lock protection
- Freemium business model
- Google OAuth authentication