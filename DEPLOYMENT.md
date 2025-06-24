# ShareZidi Deployment Guide - Easypanel on Hostinger VPS

## Prerequisites
- Hostinger VPS with Easypanel installed
- Domain name pointed to your VPS IP
- Easypanel admin access

## Step 1: Prepare Application for Production

### Create Production Build Script
Add to package.json:
```json
{
  "scripts": {
    "start": "NODE_ENV=production node dist/server/index.js",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "tsc --project tsconfig.server.json"
  }
}
```

### Environment Variables for Easypanel
Set these in Easypanel app settings:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@postgres:5432/sharezidi
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=generate_random_32_char_string
```

## Step 2: Easypanel Deployment

### Create New Application
1. Login to Easypanel dashboard
2. Click "Create App" → "From Source"
3. Connect your GitHub repository
4. Choose Node.js template

### Configure Application Settings
```yaml
# App Configuration
Name: sharezidi
Source: GitHub Repository
Branch: main
Build Command: npm run build
Start Command: npm start
Port: 3000
```

### Database Setup
1. Create PostgreSQL service in Easypanel
2. Database name: `sharezidi`
3. Note the connection details for DATABASE_URL

### Domain Setup
1. Add your domain in Easypanel
2. Enable SSL certificate (automatic)
3. Point domain to your app

## Step 3: Google OAuth Setup

### Google Cloud Console Configuration
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`
4. Add authorized JavaScript origins: `https://yourdomain.com`
5. Copy Client ID and Secret to Easypanel environment variables

## Step 4: Database Migration

### Run Database Setup
```bash
# SSH into your container or use Easypanel terminal
npm run db:push
```

## Step 5: File Structure for Production

### Static File Serving
The app automatically serves static files from `dist/client` in production.

### WebSocket Configuration
WebSockets work automatically with Easypanel's reverse proxy.

## Step 6: Process Management

### PM2 Alternative (if needed)
Easypanel handles process management, but if you need PM2:
```json
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'sharezidi',
    script: 'dist/server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

## Step 7: Health Checks

### Add Health Endpoint
The app includes a health check at `/health` for monitoring.

## Step 8: SSL and Security

### Automatic SSL
Easypanel provides automatic SSL certificates via Let's Encrypt.

### Security Headers
The app includes security middleware for production.

## Troubleshooting

### Common Issues
1. **Database Connection**: Verify DATABASE_URL format
2. **Google OAuth**: Check redirect URIs match exactly
3. **WebSocket Issues**: Ensure domain supports WebSocket upgrades
4. **File Upload Size**: Check Easypanel file size limits

### Logs
Access logs through Easypanel dashboard or:
```bash
# In Easypanel terminal
npm run logs
```

## Monitoring

### Built-in Monitoring
- Connection status tracking
- Transfer success/failure rates
- User registration metrics
- Performance monitoring

### Easypanel Monitoring
Use Easypanel's built-in monitoring for:
- CPU/Memory usage
- Response times
- Error rates
- Uptime monitoring

## Backup Strategy

### Database Backups
Configure automatic PostgreSQL backups in Easypanel.

### Application Backups
- GitHub repository serves as code backup
- Environment variables should be documented securely

## Scaling

### Horizontal Scaling
Easypanel supports scaling to multiple instances:
1. Enable cluster mode in app settings
2. Configure session store for multiple instances
3. Use Redis for session storage if needed

### Vertical Scaling
Adjust container resources in Easypanel dashboard.