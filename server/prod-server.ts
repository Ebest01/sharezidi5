import express from "express";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { FileTransferService } from "./services/fileTransferService.js";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} in ${duration}ms`);
    return originalSend.call(this, data);
  };
  
  next();
});

const httpServer = createServer(app);
const fileTransferService = new FileTransferService();

// WebSocket setup
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws: WebSocket, request) => {
  const userId = Math.random().toString(36).substring(2, 8);
  const ip = request.socket.remoteAddress;
  
  console.log(`[WebSocket] New connection from: ${ip}`);
  
  // Register user with file transfer service
  fileTransferService.registerUser(userId, ws);
  
  ws.on('close', () => {
    console.log(`[WebSocket] User ${userId} disconnected`);
    fileTransferService.unregisterUser(userId);
  });
  
  ws.on('error', (error) => {
    console.error(`[WebSocket] Error for user ${userId}:`, error);
    fileTransferService.unregisterUser(userId);
  });
});

// Basic API routes (no database for production)
app.get('/api/auth/user', (req, res) => {
  res.json({ id: 'guest', email: 'guest@sharezidi.com', transferCount: 0, isPro: false, isGuest: true });
});

app.post('/api/auth/register', (req, res) => {
  res.json({ success: true, message: 'Registration disabled in production' });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ success: true, message: 'Login disabled in production' });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Health check with detailed status
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
    },
    pid: process.pid
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Server error:", err);
  res.status(status).json({ message });
});

// Serve static files from client/dist
const distPath = path.resolve(process.cwd(), "client", "dist");
app.use(express.static(distPath));

// Catch-all handler for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const port = parseInt(process.env.PORT || "5000");

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`ShareZidi production server running on port ${port}`);
  console.log(`Serving static files from: ${distPath}`);
  console.log(`WebSocket server available at /ws`);
  console.log(`Process ID: ${process.pid}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});