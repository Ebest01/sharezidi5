# Easypanel Deployment Guide for ShareZidi

## Step-by-Step Deployment Process

### 1. Choose Build Method
✅ **Select: Dockerfile** 
- Your project has optimized Docker configuration
- Multi-stage build for production efficiency
- Handles both frontend build and backend setup

### 2. After Selecting Dockerfile
You'll see these configuration options:

**Build Settings:**
- Build Context: `.` (root directory)
- Dockerfile Path: `./Dockerfile` (default)

**Port Configuration:**
- Container Port: `5000`
- Public Port: `80` or `443` (for HTTPS)

### 3. Environment Variables to Set
```
DATABASE_URL=postgresql://username:password@host:port/database
GOOGLE_CLIENT_ID=your_google_oauth_client_id  
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
SESSION_SECRET=your_secure_random_session_secret
NODE_ENV=production
PORT=5000
```

### 4. Domain Configuration
- Set your custom domain
- Enable automatic SSL (Let's Encrypt)
- Force HTTPS redirect

### 5. Create Database Service First
Before deploying the app:
1. Create PostgreSQL service in same project
2. Note the connection details
3. Use those details in DATABASE_URL environment variable

## Why Dockerfile is Best Choice:

1. **Optimized**: Multi-stage build reduces image size
2. **Production-Ready**: Proper Node.js production setup
3. **Security**: Non-root user, minimal attack surface
4. **Performance**: Only production dependencies included
5. **Health Checks**: Built-in container health monitoring

## Next Steps After Clicking Dockerfile:
1. Configure environment variables
2. Set up database service connection
3. Configure domain and SSL
4. Deploy and monitor logs