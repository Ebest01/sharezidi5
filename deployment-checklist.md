# ShareZidi Deployment Checklist

## Phase 1: GitHub Upload ✓

### Files to Upload:
- ✅ `client/` folder (React frontend)
- ✅ `server/` folder (Express backend) 
- ✅ `shared/` folder (Types and schemas)
- ✅ `package.json` (Dependencies)
- ✅ `package-lock.json` (Lock file)
- ✅ `tsconfig.json` (TypeScript config)
- ✅ `tsconfig.server.json` (Server build config)
- ✅ `vite.config.ts` (Vite config)
- ✅ `tailwind.config.ts` (Tailwind config)
- ✅ `components.json` (UI components)
- ✅ `drizzle.config.ts` (Database config)
- ✅ `Dockerfile` (Container config)
- ✅ `docker-compose.yml` (Development setup)
- ✅ `.dockerignore` (Docker ignore rules)
- ✅ `README.md` (Project documentation)
- ✅ `DEPLOYMENT.md` (Deployment guide)
- ✅ `.gitignore` (Git ignore rules)

### Files to EXCLUDE:
- ❌ `node_modules/` (Dependencies folder)
- ❌ `dist/` (Build output)
- ❌ `.env` (Environment variables)
- ❌ `.replit` (Replit specific)
- ❌ `replit.nix` (Replit specific)
- ❌ `.upm/` (Package manager cache)

## Phase 2: Easypanel Setup

### Prerequisites:
- [ ] Hostinger VPS with Easypanel installed
- [ ] Domain name pointed to VPS IP
- [ ] GitHub repository created and uploaded

### Steps:
1. [ ] Login to Easypanel dashboard
2. [ ] Create new app from GitHub source
3. [ ] Configure build settings:
   - Build command: `npm run build`
   - Start command: `npm start` 
   - Port: `3000`
4. [ ] Create PostgreSQL service
5. [ ] Set environment variables
6. [ ] Configure domain and SSL

## Phase 3: Environment Variables

### Required Variables:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@postgres:5432/sharezidi
SESSION_SECRET=generate_32_character_random_string
```

### Google OAuth (Optional):
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Phase 4: Database Setup

### Commands to run in Easypanel terminal:
```bash
npm run db:push
```

## Phase 5: Domain Configuration

### DNS Settings:
- [ ] A record: `yourdomain.com` → VPS IP
- [ ] CNAME record: `www.yourdomain.com` → `yourdomain.com`

### SSL Certificate:
- [ ] Automatic via Let's Encrypt (handled by Easypanel)

## Phase 6: Google OAuth Setup

### Google Cloud Console:
1. [ ] Create OAuth 2.0 Client ID
2. [ ] Set authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`
3. [ ] Set authorized JavaScript origins: `https://yourdomain.com`
4. [ ] Copy Client ID and Secret to environment variables

## Phase 7: Testing

### Functionality Tests:
- [ ] Application loads at domain
- [ ] WebSocket connection works
- [ ] File selection and transfer
- [ ] User registration/login
- [ ] Google OAuth (if configured)
- [ ] Mobile responsiveness
- [ ] QR code generation

### Performance Tests:
- [ ] Large file transfers
- [ ] Multiple concurrent users
- [ ] Mobile device transfers
- [ ] Cross-device compatibility

## Phase 8: Monitoring

### Health Checks:
- [ ] `/health` endpoint responding
- [ ] Database connectivity
- [ ] WebSocket functionality
- [ ] Error logging working

### Backup:
- [ ] Database backup configured
- [ ] Environment variables documented
- [ ] GitHub repository up to date

## Quick Commands Reference

### GitHub Upload (Web):
1. Create repository on GitHub
2. Upload files via web interface
3. Exclude build/cache folders

### Easypanel Deploy:
1. Connect GitHub repository
2. Set build/start commands
3. Configure environment variables
4. Deploy and test

### Database Migration:
```bash
npm run db:push
```

### View Logs:
```bash
# In Easypanel terminal
npm run logs
```