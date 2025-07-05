import express from "express";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { FileTransferService } from "./services/fileTransferService.js";
import fs from "fs";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} in ${duration}ms`);
    return originalSend.call(this, data);
  };

  next();
});

const httpServer = createServer(app);
const fileTransferService = new FileTransferService();

// WebSocket setup
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws: WebSocket, request) => {
  const userId = Math.random().toString(36).substring(2, 8);
  const ip = request.socket.remoteAddress;

  console.log(`[WebSocket] New connection from: ${ip}`);

  // Register user with file transfer service
  fileTransferService.registerUser(userId, ws);

  ws.on("close", () => {
    console.log(`[WebSocket] User ${userId} disconnected`);
    fileTransferService.unregisterUser(userId);
  });

  ws.on("error", (error) => {
    console.error(`[WebSocket] Error for user ${userId}:`, error);
    fileTransferService.unregisterUser(userId);
  });
});

// Simple in-memory session store for production
const sessions = new Map<string, { userId: string; createdAt: number }>();

console.log("[DEBUG] ===== SIMPLE PRODUCTION SERVER STARTING =====");
console.log("[DEBUG] Environment:", {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL_EXISTS: !!process.env.DATABASE_URL
});

// Simplified authentication endpoints
app.get("/api/auth/user", (req, res) => {
  console.log("[DEBUG] ===== AUTH CHECK START =====");
  
  const sessionId = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1];
  
  console.log("[DEBUG] Session lookup:", {
    sessionId: sessionId,
    cookieHeader: req.headers.cookie,
    authHeader: req.headers.authorization
  });
  
  const session = sessions.get(sessionId || '');
  console.log("[DEBUG] Session found:", session);
  
  if (session && session.userId === "admin") {
    console.log("[DEBUG] Admin session valid - returning admin user");
    console.log("[DEBUG] ===== AUTH CHECK END (SUCCESS) =====");
    return res.json({
      id: 1,
      email: "deshabunda2@gmail.com",
      username: "AxDMIxN",
      transferCount: 0,
      isPro: true,
      isGuest: false,
    });
  }
  
  console.log("[DEBUG] No valid session - returning guest");
  console.log("[DEBUG] ===== AUTH CHECK END (GUEST) =====");
  res.json({
    id: "guest",
    email: "guest@sharezidi.com",
    transferCount: 0,
    isPro: false,
    isGuest: true,
  });
});

app.post("/api/auth/register", (req, res) => {
  console.log("[DEBUG] Registration attempt (disabled in production)");
  res.json({ success: true, message: "Registration disabled in production" });
});

app.post("/api/auth/login", (req, res) => {
  console.log("[DEBUG] ===== LOGIN ATTEMPT START =====");
  const { email, password } = req.body;
  console.log("[DEBUG] Login attempt:", { email, hasPassword: !!password });
  
  // Check for admin credentials
  if ((email === "AxDMIxN" || email === "deshabunda2@gmail.com") && password === "AZQ00001xx") {
    const sessionId = Math.random().toString(36).substring(2, 15);
    const sessionData = { userId: "admin", createdAt: Date.now() };
    sessions.set(sessionId, sessionData);
    
    console.log("[DEBUG] Admin login successful:", {
      sessionId: sessionId,
      sessionData: sessionData,
      totalSessions: sessions.size
    });
    
    // Set session cookie
    res.cookie('sessionId', sessionId, { 
      httpOnly: true, 
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });
    
    console.log("[DEBUG] ===== LOGIN ATTEMPT END (SUCCESS) =====");
    return res.json({
      success: true,
      user: {
        id: 1,
        email: "deshabunda2@gmail.com",
        username: "AxDMIxN",
        transferCount: 0,
        isPro: true,
        isGuest: false
      }
    });
  }
  
  console.log("[DEBUG] Invalid credentials");
  console.log("[DEBUG] ===== LOGIN ATTEMPT END (FAILED) =====");
  res.status(401).json({ error: "Invalid credentials" });
});

app.post("/api/auth/logout", (req, res) => {
  console.log("[DEBUG] Logout attempt");
  const sessionId = req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1];
  if (sessionId) {
    sessions.delete(sessionId);
    console.log("[DEBUG] Session deleted:", sessionId);
  }
  res.clearCookie('sessionId');
  res.json({ success: true });
});

// Health check with detailed status
app.get("/health", (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
    },
    pid: process.pid,
    activeSessions: sessions.size,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Server error:", err);
  res.status(status).json({ message });
});

// DEBUGGING: Find the correct static file path
console.log("=== DEBUGGING STATIC FILE PATHS ===");
console.log("Current working directory:", process.cwd());

const possiblePaths = [
  path.resolve(process.cwd(), "dist", "public"),
  path.resolve(process.cwd(), "client", "dist"),
  path.resolve(process.cwd(), "dist"),
  path.resolve("/app/dist/public"),
  path.resolve("/app/client/dist"),
  path.resolve("/app/dist"),
];

let distPath;
for (const p of possiblePaths) {
  console.log(`Checking path: ${p}`);
  try {
    if (fs.existsSync(p)) {
      const files = fs.readdirSync(p);
      console.log(
        `  📁 Directory exists, files: ${files.slice(0, 5).join(", ")}${files.length > 5 ? "..." : ""}`,
      );

      if (fs.existsSync(path.join(p, "index.html"))) {
        distPath = p;
        console.log(`  ✅ Found index.html at: ${distPath}`);
        break;
      } else {
        console.log(`  ❌ No index.html found`);
      }
    } else {
      console.log(`  ❌ Directory doesn't exist`);
    }
  } catch (e) {
    console.log(`  ❌ Error checking path: ${(e as Error).message}`);
  }
}

if (!distPath) {
  console.error("❌ Could not find index.html in any expected location");
  console.log("Available directories:");
  try {
    const rootFiles = fs.readdirSync(process.cwd());
    console.log(`Root directory files: ${rootFiles.join(", ")}`);
  } catch (e) {
    console.error("Can't read root directory");
  }
  distPath = path.resolve(process.cwd(), "dist", "public"); // fallback
}

console.log(`🎯 Using static path: ${distPath}`);
console.log("=== END DEBUGGING ===");

// Serve static files with proper MIME types
app.use(express.static(distPath, {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Catch-all handler for SPA (only for non-asset requests)
app.get("*", (req, res) => {
  // Don't serve index.html for asset requests
  if (req.url.startsWith('/assets/') || 
      req.url.startsWith('/static/') || 
      req.url.endsWith('.js') || 
      req.url.endsWith('.css') || 
      req.url.endsWith('.png') || 
      req.url.endsWith('.svg') || 
      req.url.endsWith('.ico')) {
    console.log(`Asset request 404: ${req.url}`);
    return res.status(404).send('Asset not found');
  }

  const indexPath = path.join(distPath, "index.html");
  console.log(`Serving SPA route ${req.url} from: ${indexPath}`);

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error(`❌ index.html not found at: ${indexPath}`);
    res.status(404).send("index.html not found");
  }
});

const port = parseInt(process.env.PORT || "3001");

// Clean up old sessions periodically (every hour)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > 24 * 60 * 60 * 1000) { // 24 hours
      sessions.delete(sessionId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[DEBUG] Cleaned ${cleaned} expired sessions`);
  }
}, 60 * 60 * 1000);

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

httpServer
  .listen(port, "0.0.0.0", () => {
    console.log(`ShareZidi production server running on port ${port}`);
    console.log(`Serving static files from: ${distPath}`);
    console.log(`WebSocket server available at /ws`);
    console.log(`Process ID: ${process.pid}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Admin login: AxDMIxN / AZQ00001xx`);
    console.log(`Active sessions: ${sessions.size}`);
    console.log("[DEBUG] ===== SERVER STARTUP COMPLETE =====");
  })
  .on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use`);
      process.exit(1);
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });