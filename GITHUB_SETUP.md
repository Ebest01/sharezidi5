# GitHub Deployment Guide for ShareZidi

## Step 1: Create GitHub Repository

### Option A: Create via GitHub Website
1. Go to [GitHub.com](https://github.com) and sign in
2. Click "+" in top right → "New repository"
3. Repository name: `sharezidi` (or your preferred name)
4. Set to Public or Private
5. **Don't** initialize with README (we have files already)
6. Click "Create repository"

### Option B: Create via GitHub CLI (if you have it)
```bash
gh repo create sharezidi --public
```

## Step 2: Prepare Project for Git

### Create .gitignore (if not exists)
```gitignore
# Dependencies
node_modules/
npm-debug.log*

# Production builds
dist/
build/

# Environment variables
.env
.env.local
.env.production

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# IDE/Editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Replit specific
.replit
replit.nix
```

## Step 3: Initialize Git Repository

### Commands to run in terminal:
```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: ShareZidi file transfer app with freemium model"

# Add GitHub remote (replace USERNAME and REPO with your details)
git remote add origin https://github.com/USERNAME/REPO.git

# Push to GitHub
git push -u origin main
```

### If you get main/master branch error:
```bash
# Rename branch to main if needed
git branch -M main
git push -u origin main
```

## Step 4: Verify Upload

1. Go to your GitHub repository URL
2. Verify all files are uploaded except those in .gitignore
3. Check that package.json, server/, client/, and shared/ folders are there

## Step 5: Set Up for Easypanel Deployment

### Branch Protection (Optional)
1. Go to repository Settings → Branches
2. Add rule for `main` branch
3. Enable "Require pull request reviews before merging"

### Secrets for GitHub Actions (Optional)
If you want CI/CD later:
1. Go to repository Settings → Secrets and variables → Actions
2. Add secrets for production deployment

## Common Issues & Solutions

### Authentication Issues
- Use Personal Access Token instead of password
- Generate token at: GitHub Settings → Developer settings → Personal access tokens

### Large File Issues
- Remove large files/folders before git add
- Use .gitignore to exclude build folders

### Permission Issues
```bash
# If you get permission denied
git remote set-url origin https://USERNAME:TOKEN@github.com/USERNAME/REPO.git
```

## Next Steps After GitHub

1. **Test GitHub Integration**: Verify repository is accessible
2. **Easypanel Setup**: Connect Easypanel to your GitHub repository
3. **Environment Variables**: Set up production environment variables
4. **Domain Configuration**: Configure domain and SSL
5. **Database Setup**: Create PostgreSQL service in Easypanel

## Repository Structure Check

Your repository should contain:
```
├── client/                 # React frontend
├── server/                 # Express backend
├── shared/                 # Shared types and schemas
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
├── Dockerfile             # Production container setup
├── docker-compose.yml     # Local development setup
├── DEPLOYMENT.md          # Easypanel deployment guide
└── README.md              # Project documentation
```