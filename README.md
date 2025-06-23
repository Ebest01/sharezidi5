# ShareZidi - Real-time File Transfer Application

ShareZidi is a modern, real-time peer-to-peer file sharing application that allows seamless file transfers between devices using WebSocket connections. The application features advanced chunk-based file transfer with synchronization monitoring, error recovery, and optimized performance.

## Features

- **Real-time File Transfer**: WebSocket-based instant file sharing between devices
- **Synchronization Monitoring**: Track sender/receiver progress with sync lag detection
- **Error Recovery**: Automatic retry logic for failed chunks and network issues
- **Mobile Support**: QR code generation for easy mobile device connections
- **Optimized Performance**: Adaptive chunk sizing based on network conditions
- **Modern UI**: Beautiful, responsive interface built with React and Tailwind CSS

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Express.js + Node.js + WebSocket (ws)
- **Database**: PostgreSQL with Drizzle ORM
- **Build Tool**: Vite
- **UI Components**: Radix UI primitives with shadcn/ui

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd sharezidi
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create .env file
cp .env.example .env

# Edit .env with your database URL
DATABASE_URL=postgresql://username:password@localhost:5432/sharezidi
PORT=5000
```

4. Set up the database:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Production Deployment

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Set to "production" for production builds

## File Transfer Features

### Synchronization Improvements
- Fixed sender reaching 100% while receiver at 22% issue
- Added flow control to prevent overwhelming connections
- Proper acknowledgment system between devices
- Reduced chunk sizes for better sync (8KB-64KB)

### Mobile Device Connection
- QR code generation for easy mobile access
- Automatic network IP detection
- Public URL support for deployment
- Multiple connection methods

## API Endpoints

- `POST /api/generate-qr` - Generate QR codes for connection URLs
- `GET /api/network-info` - Get local network information
- `WebSocket /ws` - Real-time file transfer communication

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push database schema changes

### Project Structure

```
├── client/               # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility libraries
│   │   └── types/        # TypeScript types
├── server/               # Express backend
│   ├── services/         # Business logic services
│   ├── routes.ts         # API routes and WebSocket setup
│   └── index.ts          # Server entry point
├── shared/               # Shared types and schemas
└── package.json          # Dependencies and scripts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details