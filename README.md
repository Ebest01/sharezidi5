# ShareZidi - Real-time File Transfer Application

A modern, real-time peer-to-peer file sharing application with mobile optimization, ZIP compression, and freemium business model.

## Features

### Core Functionality
- **Real-time file transfers** via WebSocket connections
- **Chunk-based transfer** with progress tracking and error recovery
- **ZIP compression** for multiple file transfers
- **Cross-device compatibility** (desktop, mobile, tablet)
- **QR code sharing** for easy mobile connections

### Mobile Optimization
- **Wake lock protection** prevents device sleep during transfers
- **Background sync** maintains transfers when app is backgrounded
- **Network resilience** with automatic reconnection
- **Touch-optimized interface** for mobile devices

### Business Model
- **Free tier**: 15 transfers per month
- **Pro tier**: Unlimited transfers
- **Email registration** for user tracking and marketing
- **Guest mode** for quick access
- **Usage tracking** with upgrade prompts

### Authentication
- **Google OAuth integration** for easy sign-up
- **Traditional email/password** registration
- **Session management** with secure storage
- **Guest mode** fallback

## Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS + shadcn/ui components
- Vite for development and production builds
- Custom hooks for WebSocket and file transfer logic

### Backend
- Express.js with TypeScript
- WebSocket (ws) for real-time communication
- PostgreSQL with Drizzle ORM
- Passport.js for authentication
- bcrypt for password hashing

### Infrastructure
- Docker containerization
- Easypanel deployment
- PostgreSQL database with persistent storage
- Automatic SSL certificates
- Health monitoring and logging

## Quick Start

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:5000
```

### Environment Variables
```env
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/sharezidi
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=your_random_secret
```

### Database Setup
```bash
# Push schema to database
npm run db:push
```

## Deployment

### Easypanel (Recommended)
See [DEPLOYMENT.md](DEPLOYMENT.md) for complete Easypanel deployment guide.

### Docker
```bash
# Build and run with Docker Compose
docker-compose up --build
```

## Project Structure

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utility functions
├── server/                 # Express backend application
│   ├── services/           # Business logic services
│   ├── routes.ts          # API routes and WebSocket setup
│   └── storage.ts         # Data access layer
├── shared/                 # Shared types and schemas
│   ├── schema.ts          # Database schema with Drizzle
│   └── types.ts           # TypeScript type definitions
└── dist/                  # Production build output
```

## Key Features Detail

### File Transfer System
- **Optimized chunking** based on file size and network conditions
- **Parallel transfers** for improved speed
- **Progress synchronization** between sender and receiver
- **Automatic retry** for failed chunks
- **Duplicate detection** and handling

### Mobile Protection
- **Wake Lock API** integration
- **Service Worker** for background sync
- **Heartbeat system** with multiple fallback strategies
- **Network quality detection** and adaptation

### User Experience
- **Drag and drop** file selection
- **Real-time progress** tracking
- **Visual transfer status** indicators
- **Error recovery** with user guidance
- **Responsive design** for all screen sizes

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/user` - Get current user
- `POST /api/auth/logout` - User logout
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback

### Health Monitoring
- `GET /health` - Application health check

### WebSocket Events
- `registered` - User registration confirmation
- `devices` - Available device list
- `transfer-request` - Incoming transfer request
- `file-chunk` - File data chunk
- `chunk-ack` - Chunk acknowledgment
- `sync-status` - Transfer synchronization status

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For deployment help, see [DEPLOYMENT.md](DEPLOYMENT.md)
For GitHub setup, see [GITHUB_SETUP.md](GITHUB_SETUP.md)