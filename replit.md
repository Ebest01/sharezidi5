# ShareZidi - Real-time File Transfer Application

## Overview
ShareZidi is a real-time, peer-to-peer file sharing application designed for instant file transfers between devices. It utilizes WebSocket connections for efficient communication and features advanced chunk-based transfer, synchronization monitoring, and error recovery for optimized performance across various network conditions. The project aims to provide a robust and user-friendly solution for fast and reliable file sharing, with ambitions for a freemium business model including free and pro tiers.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui and Radix UI components
- **State Management**: React hooks
- **Build Tool**: Vite
- **Key Components**: FileSelector (drag-and-drop), DeviceList, TransferSyncMonitor, ErrorRecoveryPanel, ConnectionHelper (QR code generation).
- **Core Features**: Chunk-based file transfer with progress tracking, parallel streams, error recovery (auto-retry), synchronization monitoring, Mobile Transfer Protection (Wake Lock API, service worker, heartbeat system), ZIP and send functionality using JSZip, responsive UI/UX.
- **UI/UX Decisions**: Clean interface, dynamic copyright footer, integrated ShareZidi logo, mobile-friendly design with touch-optimized elements, accessibility features (ARIA labels), QR code for mobile connections.

### Backend
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js 20
- **WebSocket**: `ws` library for real-time communication
- **Database**: PostgreSQL with Drizzle ORM (primarily for user authentication/session)
- **Session Management**: Connect-pg-simple for PostgreSQL session storage
- **Core Features**: Manages connected users and file transfers, handles chunked transfers, connection cleanup, device discovery, authentication (email/password, Google OAuth, BCrypt hashing), user tracking with geolocation, freemium model enforcement.

### Data Flow
1. WebSocket connection and user registration.
2. Device discovery broadcast.
3. File selection and transfer initiation.
4. Chunk processing and parallel transfer.
5. Real-time progress monitoring and error handling.
6. File reassembly on receiver side.

## External Dependencies

- **React Ecosystem**: React, React DOM, TypeScript
- **UI Libraries**: @radix-ui, Tailwind CSS, shadcn/ui
- **Backend**: Express, `ws` (WebSocket), Drizzle ORM
- **Database**: @neondatabase/serverless (PostgreSQL driver), PostgreSQL, MongoDB (for user data, analytics, session management)
- **Authentication**: `passport-google-oauth20`, `bcrypt`, `express-session`
- **Compression**: `JSZip`
- **Development Tools**: Vite, ESBuild, TSX
- **Deployment**: Easypanel (Hostinger VPS) using Buildpacks