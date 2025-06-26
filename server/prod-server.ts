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

// Basic API routes (no database for production)
app.get("/api/auth/user", (req, res) => {
  res.json({
    id: "guest",
    email: "guest@sharezidi.com",
    transferCount: 0,
    isPro: false,
    isGuest: true,
  });
});

app.post("/api/auth/register", (req, res) => {
  res.json({ success: true, message: "Registration disabled in production" });
});

app.post("/api/auth/login", (req, res) => {
  res.json({ success: true, message: "Login disabled in production" });
});

app.post("/api/auth/logout", (req, res) => {
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
    console.log(`  ❌ Error checking path: ${e.message}`);
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

// Serve static files
app.use(express.static(distPath));

// Catch-all handler for SPA
app.get("*", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  console.log(`Serving index.html from: ${indexPath}`);

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error(`❌ index.html not found at: ${indexPath}`);
    res.status(404).send("index.html not found");
  }
});

const port = parseInt(process.env.PORT || "5000");

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
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use`);
      process.exit(1);
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });
