# Deployment Guide for ShareZidi

## Option 1: Deploy to VPS with EasyPanel

### Step 1: Prepare Repository

1. **Create GitHub Repository**:
   - Go to GitHub and create a new repository
   - Name it `sharezidi` or your preferred name
   - Make it public for easier deployment

2. **Push Code to GitHub**:
   ```bash
   # Initialize git if not already done
   git init
   
   # Add all files
   git add .
   
   # Commit changes
   git commit -m "Initial ShareZidi deployment"
   
   # Add your GitHub repository as origin
   git remote add origin https://github.com/yourusername/sharezidi.git
   
   # Push to GitHub
   git push -u origin main
   ```

### Step 2: Deploy on EasyPanel

1. **Access EasyPanel**:
   - Log into your VPS EasyPanel dashboard

2. **Create New Project**:
   - Click "New Project" or "Add Application"
   - Choose "GitHub Repository" as source

3. **Configure Repository**:
   - Repository URL: `https://github.com/yourusername/sharezidi.git`
   - Branch: `main`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **Environment Variables**:
   Add these environment variables in EasyPanel:
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=postgresql://username:password@localhost:5432/sharezidi
   ```

5. **Database Setup**:
   - Create a PostgreSQL database in EasyPanel
   - Update DATABASE_URL with your database credentials
   - Run database migrations: `npm run db:push`

### Step 3: Domain Configuration

1. **Custom Domain** (Optional):
   - In EasyPanel, go to your app settings
   - Add your custom domain
   - Configure DNS to point to your VPS

2. **SSL Certificate**:
   - EasyPanel usually provides automatic SSL
   - Verify HTTPS is working for WebSocket connections

## Option 2: Docker Deployment

If your VPS supports Docker:

1. **Build and Run**:
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/sharezidi.git
   cd sharezidi
   
   # Build and start with Docker Compose
   docker-compose up -d
   ```

2. **Environment Configuration**:
   - Edit `docker-compose.yml` for your database credentials
   - Application will be available on port 5000

## Option 3: Manual VPS Deployment

1. **Server Setup**:
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PostgreSQL
   sudo apt install postgresql postgresql-contrib
   ```

2. **Application Deployment**:
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/sharezidi.git
   cd sharezidi
   
   # Install dependencies
   npm install
   
   # Set up environment
   cp .env.example .env
   # Edit .env with your database credentials
   
   # Build application
   npm run build
   
   # Set up database
   npm run db:push
   
   # Start application (consider using PM2 for production)
   npm install -g pm2
   pm2 start npm --name "sharezidi" -- start
   pm2 startup
   pm2 save
   ```

3. **Nginx Configuration**:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
       
       # WebSocket support
       location /ws {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

## Post-Deployment Steps

1. **Test File Transfer**:
   - Access your deployed URL
   - Test WebSocket connection
   - Try file transfer between devices

2. **Mobile Testing**:
   - Use QR code feature to connect mobile devices
   - Test file transfers from iPhone/Android

3. **Monitor Performance**:
   - Check server logs for any issues
   - Monitor resource usage
   - Set up backup strategies for database

## Troubleshooting

### Common Issues:

1. **WebSocket Connection Failed**:
   - Ensure WebSocket path `/ws` is properly proxied
   - Check firewall settings for port 5000
   - Verify SSL/TLS configuration for WSS

2. **Database Connection Issues**:
   - Verify DATABASE_URL is correct
   - Check PostgreSQL service is running
   - Ensure database user has proper permissions

3. **Build Failures**:
   - Check Node.js version (requires 18+)
   - Verify all dependencies are installed
   - Check available disk space and memory

4. **File Transfer Issues**:
   - Test with small files first
   - Check network connectivity between devices
   - Monitor browser console for errors

## Security Considerations

1. **Environment Variables**:
   - Never commit .env files to git
   - Use strong database passwords
   - Rotate credentials regularly

2. **Network Security**:
   - Configure firewall properly
   - Use HTTPS in production
   - Implement rate limiting if needed

3. **File Upload Limits**:
   - Consider implementing file size limits
   - Add virus scanning for uploaded files
   - Monitor disk usage