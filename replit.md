# ShareZidi - Real-time File Transfer Application

## Overview

ShareZidi is a real-time peer-to-peer file sharing application built with React frontend and Express backend, utilizing WebSocket connections for instant file transfers between devices. The application features advanced chunk-based file transfer with synchronization monitoring, error recovery, and optimized performance based on network conditions.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: React hooks with custom hooks for WebSocket and file transfer logic
- **Build Tool**: Vite for development and production builds
- **UI Components**: Comprehensive set of Radix UI primitives with custom styling

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js 20 with ES modules
- **WebSocket**: ws library for real-time communication
- **Database**: PostgreSQL with Drizzle ORM (schema defined but minimal usage)
- **Session Management**: Connect-pg-simple for PostgreSQL session storage

### Database Schema
- **Users Table**: Basic user authentication with username/password
- **ORM**: Drizzle with PostgreSQL dialect
- **Migrations**: Managed through drizzle-kit

## Key Components

### WebSocket Communication (`FileTransferService`)
- Manages connected users and active file transfers
- Handles chunked file transfer with progress tracking
- Implements connection cleanup and error recovery
- Supports transfer synchronization monitoring

### File Transfer System
- **Chunk-based Transfer**: Files split into optimized chunks based on size and network conditions
- **Parallel Streams**: Multiple concurrent chunk transfers for improved speed
- **Progress Tracking**: Real-time progress monitoring for both sender and receiver
- **Error Recovery**: Automatic retry logic for failed chunks and network issues
- **Sync Monitoring**: Tracks sender/receiver synchronization with duplicate chunk detection

### Frontend Components
- **ShareZidiApp**: Main application container
- **FileSelector**: Drag-and-drop file selection with preview
- **DeviceList**: Shows available devices for file sharing
- **TransferSyncMonitor**: Real-time transfer progress and synchronization status
- **ErrorRecoveryPanel**: Handles transfer issues and recovery options

### Custom Hooks
- **useWebSocket**: Manages WebSocket connection with auto-reconnect
- **useFileTransfer**: Handles file selection, transfer logic, and progress tracking
- **useIsMobile**: Responsive design detection

## Data Flow

1. **Connection**: Users connect via WebSocket and register with unique IDs
2. **Discovery**: Connected devices are broadcast to all users
3. **File Selection**: Users select files through drag-and-drop or file picker
4. **Transfer Initiation**: Sender requests transfer to target device
5. **Chunk Processing**: Files are split into optimized chunks and sent in parallel
6. **Progress Monitoring**: Real-time tracking of sent/received chunks with sync status
7. **Error Handling**: Automatic retry and recovery for failed transfers
8. **Completion**: Files are reassembled on receiver side

## External Dependencies

### Core Dependencies
- **React Ecosystem**: React, React DOM, TypeScript
- **UI Library**: @radix-ui components, Tailwind CSS, shadcn/ui
- **Backend**: Express, ws (WebSocket), Drizzle ORM
- **Database**: @neondatabase/serverless, PostgreSQL driver
- **Development**: Vite, ESBuild, TSX for development server

### Optional Features
- **Authentication**: Basic user registration (minimal implementation)
- **Session Storage**: PostgreSQL-based session management
- **File Compression**: Infrastructure for ZIP functionality (not fully implemented)

## Deployment Strategy

### Development
- **Command**: `npm run dev`
- **Server**: TSX with hot reloading
- **Client**: Vite dev server with HMR
- **Database**: Drizzle migrations with `npm run db:push`

### Production
- **Build**: `npm run build` - compiles both frontend and backend
- **Server**: Node.js with compiled JavaScript
- **Frontend**: Static files served by Express
- **Database**: PostgreSQL connection via environment variables

### Environment Configuration
- **DATABASE_URL**: Required for PostgreSQL connection
- **PORT**: Server port (defaults to 5000)
- **NODE_ENV**: Environment detection for development/production features

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### June 25, 2025 - Easypanel Production Deployment Complete ✓
- Successfully deployed ShareZidi to Hostinger VPS using Easypanel
- Configured multi-stage Dockerfile resolving Vite build dependencies
- Created PostgreSQL database with security-conscious naming (sharexzidix)
- Updated database driver from Neon to standard PostgreSQL for VPS compatibility
- Added session storage table for express-session support
- Environment configuration documented for Google OAuth and database connection
- Production deployment pipeline established: Replit → GitHub → Easypanel → Live

### June 25, 2025 - GitHub Repository Successfully Populated
- Resolved Git lock file issues that were preventing normal Git operations
- Successfully configured Git remote connection to GitHub repository (sharezidi2)
- Pushed complete ShareZidi application to GitHub with all production files
- Established proper development workflow: Code changes → Git push → GitHub → Easypanel deployment
- Repository now contains complete application ready for Easypanel deployment on Hostinger VPS

### June 23, 2025 - File Transfer System Complete with Mobile Protection
- Fixed critical sender/receiver synchronization issues where sender reached 100% while receiver was at 22%
- Resolved device visibility race conditions that prevented devices from seeing each other consistently
- Fixed file selection crashes caused by NaN/undefined errors in formatFileName and file size calculations
- Implemented proper WebSocket message handlers for file-chunk, sync-status, and transfer-complete events
- Used Object.assign() instead of spread operator to preserve File prototype methods (slice function)
- Added comprehensive error handling and logging throughout the transfer process
- Established proper registration flow with delayed device list broadcasting to prevent timing issues
- File transfers now work end-to-end with real-time progress tracking and automatic chunk acknowledgment
- Added QR code generation for mobile device connections
- Improved WebSocket connection stability with ping/pong mechanism and singleton pattern

### Mobile Transfer Protection System
- Implemented comprehensive FileTransferManager with Wake Lock API to prevent mobile device sleep
- Added service worker registration for background sync capabilities
- Created heartbeat system with multiple fallback strategies (network requests, DOM operations)
- Built visibility change handlers to maintain transfers when app goes to background
- Added MobileTransferGuard component with visual warnings for mobile users
- Integrated exponential backoff reconnection for better mobile network handling
- Faster ping intervals (15s) optimized for mobile connection monitoring

### ZIP and Send Functionality
- Implemented ZIP compression using JSZip library for multiple file transfers
- Added progress tracking for ZIP creation process with visual feedback
- Automatic file naming with timestamp and file count for organized downloads
- Compression ratio calculation and logging for transfer optimization
- ZipProgress component shows real-time compression status
- Smart file selection hints encourage users to compress multiple files
- Seamless integration with existing transfer system and mobile protection

### Mobile Connection Support
- Added ConnectionHelper component with QR code generation
- Automatic network IP detection for local connections
- Public URL detection for deployed environments
- Mobile-friendly interface improvements

### File Management Interface
- Added individual file remove buttons that are always visible for mobile compatibility
- Implemented "Clear all files" functionality for bulk removal
- Enhanced file selection with proper layout and truncation for long filenames
- Smart tooltips and hints with accessibility features (ARIA labels)
- Mobile-friendly design with touch-optimized button sizes

### Freemium Business Model
- Email-based registration system for user tracking and marketing
- Guest mode for quick access without registration
- Free tier: 15 transfers per month with usage tracking
- Pro tier: Unlimited transfers with visual badge
- Usage banners show remaining transfers and upgrade prompts
- Simple localStorage-based session management
- Transfer limit enforcement with upgrade prompts

### Authentication System
- Google OAuth integration with passport-google-oauth20
- Traditional email/password registration and login
- Session-based authentication with express-session
- Automatic user detection from Google auth callbacks
- Fallback to localStorage for guest users
- Password hashing with bcrypt for security
- API endpoints for register/login/logout/user-info

### Mobile Connection Support
- Added ConnectionHelper component with QR code generation
- Automatic network IP detection for local connections
- Public URL detection for deployed environments
- Mobile-friendly interface improvements

## Deployment Notes
- For testing with mobile devices, deployment to public URL is required
- Development server uses internal IPs not accessible from external devices
- QR code generation works for both local and deployed environments

### Easypanel Deployment (Hostinger VPS) - COMPLETED ✓
- Multi-stage Docker configuration successfully deployed
- PostgreSQL database service created with secure naming (sharexzidix/sharexzidix_user)
- Database configured with standard PostgreSQL driver instead of Neon
- Session storage table added for express-session compatibility
- Environment variables ready for configuration in Easypanel dashboard
- GitHub repository (sharezidi2) connected for continuous deployment
- Production-ready build process with proper dependency management