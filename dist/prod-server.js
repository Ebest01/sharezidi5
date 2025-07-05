var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// server/prod-server.ts
import express from "express";
import path from "path";
import { WebSocketServer } from "ws";
import { createServer } from "http";

// server/services/fileTransferService.ts
import { WebSocket } from "ws";
var FileTransferService = class {
  constructor() {
    __publicField(this, "connectedUsers", /* @__PURE__ */ new Map());
    __publicField(this, "activeTransfers", /* @__PURE__ */ new Map());
    __publicField(this, "chunkBuffers", /* @__PURE__ */ new Map());
    __publicField(this, "syncStatuses", /* @__PURE__ */ new Map());
    setInterval(() => this.cleanupStaleConnections(), 12e4);
  }
  registerUser(userId, socket, deviceName) {
    console.log(`[FileTransfer] User ${userId} (${deviceName || "Unknown Device"}) connected`);
    this.connectedUsers.set(userId, {
      id: userId,
      socket,
      lastPing: Date.now(),
      deviceName
    });
    this.setupSocketHandlers(userId, socket);
    this.sendToUser(userId, "registered", { userId });
    setTimeout(() => {
      this.broadcastUserList();
    }, 500);
  }
  unregisterUser(userId) {
    console.log(`[FileTransfer] User ${userId} disconnected`);
    this.connectedUsers.delete(userId);
    this.broadcastUserList();
    this.cancelUserTransfers(userId);
  }
  setupSocketHandlers(userId, socket) {
    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(userId, message);
      } catch (error) {
        console.error(`[FileTransfer] Failed to parse message from ${userId}:`, error);
      }
    });
    socket.on("close", () => {
      this.unregisterUser(userId);
    });
    socket.on("error", (error) => {
      console.error(`[FileTransfer] Socket error for ${userId}:`, error);
    });
  }
  handleMessage(userId, message) {
    const user = this.connectedUsers.get(userId);
    if (!user) return;
    user.lastPing = Date.now();
    switch (message.type) {
      case "register":
        if (message.data?.deviceName) {
          user.deviceName = message.data.deviceName;
          console.log(`[FileTransfer] User ${userId} updated device name to ${message.data.deviceName}`);
          this.broadcastUserList();
        }
        break;
      case "ping":
        this.sendToUser(userId, "pong", { timestamp: Date.now() });
        break;
      case "transfer-request":
        this.handleTransferRequest(userId, message.data);
        break;
      case "transfer-response":
        this.handleTransferResponse(userId, message.data);
        break;
      case "file-chunk":
        this.handleFileChunk(userId, message.data);
        break;
      case "chunk-ack":
        this.handleChunkAck(userId, message.data);
        break;
      case "transfer-complete":
        this.handleTransferComplete(userId, message.data);
        break;
      case "resume-transfer":
        this.handleResumeTransfer(userId, message.data);
        break;
      case "sync-status":
        this.handleSyncStatus(userId, message.data);
        break;
      case "cancel-transfer":
        this.handleCancelTransfer(userId, message.data);
        break;
      default:
        console.log(`[FileTransfer] Unknown message type: ${message.type}`);
    }
  }
  getDeviceDisplayName(deviceName, userId) {
    if (!deviceName || !userId) return `Device ${userId?.substring(0, 6) || "Unknown"}`;
    const shortId = userId.substring(0, 6);
    if (deviceName.includes("Windows PC")) {
      return `PC-${shortId}`;
    }
    if (deviceName.includes("Mac")) {
      return `Mac-${shortId}`;
    }
    if (deviceName.includes("iPhone")) {
      return `iPhone-${shortId}`;
    }
    if (deviceName.includes("iPad")) {
      return `iPad-${shortId}`;
    }
    if (deviceName.includes("Android")) {
      return `Android-${shortId}`;
    }
    if (deviceName.includes("Linux PC")) {
      return `Linux-${shortId}`;
    }
    return `${deviceName}-${shortId}`;
  }
  handleTransferRequest(fromUserId, data) {
    const { toUserId, fileInfo, fileId } = data;
    const toUser = this.connectedUsers.get(toUserId);
    if (!toUser) {
      this.sendToUser(fromUserId, "transfer-error", {
        error: "Target user not found",
        fileId
      });
      return;
    }
    const transferId = `${fromUserId}-${toUserId}-${fileId}`;
    const transfer = {
      deviceId: toUserId,
      fileInfo,
      sentProgress: 0,
      receivedProgress: 0,
      status: "pending",
      duplicateChunks: 0,
      missingChunks: [],
      isTransferring: false
    };
    this.activeTransfers.set(transferId, transfer);
    this.chunkBuffers.set(transferId, /* @__PURE__ */ new Map());
    const syncStatus = {
      senderId: fromUserId,
      receiverId: toUserId,
      fileId,
      senderProgress: 0,
      receiverProgress: 0,
      syncLag: 0,
      duplicatesRejected: 0,
      lastChunkTime: Date.now()
    };
    this.syncStatuses.set(transferId, syncStatus);
    this.sendToUser(toUserId, "transfer-request", {
      from: fromUserId,
      fileInfo,
      fileId
    });
  }
  handleTransferResponse(fromUserId, data) {
    const { toUserId, accepted, fileId, reason } = data;
    if (accepted) {
      const transferId = `${toUserId}-${fromUserId}-${fileId}`;
      const transfer = this.activeTransfers.get(transferId);
      if (transfer) {
        transfer.status = "active";
        transfer.isTransferring = true;
        this.activeTransfers.set(transferId, transfer);
      }
      this.sendToUser(toUserId, "transfer-accepted", { fromUserId, fileId });
    } else {
      this.sendToUser(toUserId, "transfer-rejected", { fromUserId, reason, fileId });
      const transferId = `${toUserId}-${fromUserId}-${fileId}`;
      this.activeTransfers.delete(transferId);
      this.chunkBuffers.delete(transferId);
      this.syncStatuses.delete(transferId);
    }
  }
  handleFileChunk(fromUserId, data) {
    const { toUserId, fileId, chunkIndex, chunk, totalChunks } = data;
    const transferId = `${fromUserId}-${toUserId}-${fileId}`;
    const transfer = this.activeTransfers.get(transferId);
    const syncStatus = this.syncStatuses.get(transferId);
    if (!transfer || !syncStatus) {
      console.error(`[FileTransfer] No active transfer found: ${transferId}`);
      return;
    }
    if (!this.chunkBuffers.has(transferId)) {
      this.chunkBuffers.set(transferId, /* @__PURE__ */ new Map());
    }
    const chunkBuffer = this.chunkBuffers.get(transferId);
    if (chunkBuffer.has(chunkIndex)) {
      console.log(`[FileTransfer] Duplicate chunk ${chunkIndex} rejected for ${transferId}`);
      syncStatus.duplicatesRejected++;
      transfer.duplicateChunks++;
      this.sendToUser(fromUserId, "chunk-ack", {
        chunkIndex,
        fileId,
        status: "duplicate"
      });
      return;
    }
    chunkBuffer.set(chunkIndex, chunk);
    syncStatus.lastChunkTime = Date.now();
    const receivedChunks = chunkBuffer.size;
    const receiverProgress = receivedChunks / totalChunks * 100;
    const senderProgress = Math.min((chunkIndex + 1) / totalChunks * 100, 100);
    syncStatus.senderProgress = senderProgress;
    syncStatus.receiverProgress = receiverProgress;
    syncStatus.syncLag = Math.max(0, senderProgress - receiverProgress);
    transfer.sentProgress = senderProgress;
    transfer.receivedProgress = receiverProgress;
    this.activeTransfers.set(transferId, transfer);
    this.syncStatuses.set(transferId, syncStatus);
    const toUser = this.connectedUsers.get(toUserId);
    if (toUser && toUser.socket.readyState === WebSocket.OPEN) {
      this.sendToUser(toUserId, "file-chunk", {
        from: fromUserId,
        chunkIndex,
        chunk,
        // Pass through the Base64 encoded chunk data
        totalChunks,
        fileId,
        progress: receiverProgress
        // Send receiver progress, not sender
      });
      this.sendToUser(fromUserId, "chunk-ack", {
        chunkIndex,
        fileId,
        status: "received",
        receiverProgress
      });
      this.broadcastSyncStatus(transferId);
    } else {
      console.error(`[FileTransfer] Target user ${toUserId} not available`);
      this.sendToUser(fromUserId, "transfer-error", {
        error: "Target user disconnected",
        fileId
      });
    }
  }
  handleChunkAck(fromUserId, data) {
    const { toUserId, chunkIndex, fileId, status } = data;
    const transferId = `${toUserId}-${fromUserId}-${fileId}`;
    const syncStatus = this.syncStatuses.get(transferId);
    if (syncStatus) {
      if (status === "received") {
        const transfer = this.activeTransfers.get(transferId);
        if (transfer) {
          const receiverProgress = (chunkIndex + 1) / transfer.fileInfo.totalChunks * 100;
          syncStatus.receiverProgress = receiverProgress;
          transfer.receivedProgress = receiverProgress;
          syncStatus.syncLag = Math.max(0, syncStatus.senderProgress - syncStatus.receiverProgress);
          this.activeTransfers.set(transferId, transfer);
          this.syncStatuses.set(transferId, syncStatus);
          this.broadcastSyncStatus(transferId);
        }
      } else if (status === "duplicate") {
        syncStatus.duplicatesRejected++;
        const transfer = this.activeTransfers.get(transferId);
        if (transfer) {
          transfer.duplicateChunks++;
          this.activeTransfers.set(transferId, transfer);
        }
      }
    }
    this.sendToUser(toUserId, "chunk-ack", data);
  }
  handleTransferComplete(fromUserId, data) {
    const { toUserId, fileId } = data;
    const transferId = `${fromUserId}-${toUserId}-${fileId}`;
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      transfer.status = "completed";
      transfer.isTransferring = false;
      this.activeTransfers.set(transferId, transfer);
    }
    this.sendToUser(toUserId, "transfer-complete", {
      from: fromUserId,
      fileId,
      fileName: transfer?.fileInfo.name
    });
    setTimeout(() => {
      this.activeTransfers.delete(transferId);
      this.chunkBuffers.delete(transferId);
      this.syncStatuses.delete(transferId);
    }, 3e4);
  }
  handleResumeTransfer(fromUserId, data) {
    const { toUserId, fromChunk, fileId } = data;
    const transferId = `${toUserId}-${fromUserId}-${fileId}`;
    this.sendToUser(toUserId, "resume-transfer", {
      from: fromUserId,
      fromChunk,
      fileId
    });
  }
  handleSyncStatus(fromUserId, data) {
    console.log(`[FileTransfer] Sync status from ${fromUserId}:`, data);
  }
  handleCancelTransfer(fromUserId, data) {
    const { transferId, reason } = data;
    this.activeTransfers.delete(transferId);
    this.chunkBuffers.delete(transferId);
    this.syncStatuses.delete(transferId);
    console.log(`[FileTransfer] Transfer cancelled: ${transferId}, reason: ${reason}`);
  }
  broadcastSyncStatus(transferId) {
    const syncStatus = this.syncStatuses.get(transferId);
    if (!syncStatus) return;
    this.sendToUser(syncStatus.senderId, "sync-status", syncStatus);
    this.sendToUser(syncStatus.receiverId, "sync-status", syncStatus);
  }
  sendToUser(userId, type, data) {
    const user = this.connectedUsers.get(userId);
    if (user && user.socket.readyState === WebSocket.OPEN) {
      try {
        user.socket.send(JSON.stringify({ type, data }));
        return true;
      } catch (error) {
        console.error(`[FileTransfer] Failed to send message to ${userId}:`, error);
        return false;
      }
    }
    return false;
  }
  broadcastUserList() {
    const userList = Array.from(this.connectedUsers.values()).map((user) => ({
      id: user.id,
      name: this.getDeviceDisplayName(user.deviceName, user.id)
    }));
    console.log(`[FileTransfer] Broadcasting device list:`, userList.map((u) => `${u.name} (${u.id})`));
    for (const userId of this.connectedUsers.keys()) {
      this.sendToUser(userId, "devices", userList);
      setTimeout(() => {
        this.sendToUser(userId, "devices", userList);
      }, 300);
    }
  }
  cancelUserTransfers(userId) {
    for (const [transferId, transfer] of this.activeTransfers) {
      if (transferId.includes(userId)) {
        transfer.status = "failed";
        transfer.error = "User disconnected";
        transfer.isTransferring = false;
        this.activeTransfers.delete(transferId);
        this.chunkBuffers.delete(transferId);
        this.syncStatuses.delete(transferId);
      }
    }
  }
  cleanupStaleConnections() {
    const now = Date.now();
    const staleThreshold = 3e5;
    for (const [userId, user] of this.connectedUsers) {
      if (now - user.lastPing > staleThreshold) {
        console.log(`[FileTransfer] Removing stale connection: ${userId}`);
        this.unregisterUser(userId);
      }
    }
  }
};

// server/prod-server.ts
import fs from "fs";
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
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
var httpServer = createServer(app);
var fileTransferService = new FileTransferService();
var wss = new WebSocketServer({ server: httpServer, path: "/ws" });
wss.on("connection", (ws, request) => {
  const userId = Math.random().toString(36).substring(2, 8);
  const ip = request.socket.remoteAddress;
  console.log(`[WebSocket] New connection from: ${ip}`);
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
var sessions = /* @__PURE__ */ new Map();
console.log("[DEBUG] ===== SIMPLE PRODUCTION SERVER STARTING =====");
console.log("[DEBUG] Environment:", {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL_EXISTS: !!process.env.DATABASE_URL
});
app.get("/api/auth/user", (req, res) => {
  console.log("[DEBUG] ===== AUTH CHECK START =====");
  const sessionId = req.headers.authorization?.replace("Bearer ", "") || req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1];
  console.log("[DEBUG] Session lookup:", {
    sessionId,
    cookieHeader: req.headers.cookie,
    authHeader: req.headers.authorization
  });
  const session = sessions.get(sessionId || "");
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
      isGuest: false
    });
  }
  console.log("[DEBUG] No valid session - returning guest");
  console.log("[DEBUG] ===== AUTH CHECK END (GUEST) =====");
  res.json({
    id: "guest",
    email: "guest@sharezidi.com",
    transferCount: 0,
    isPro: false,
    isGuest: true
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
  if ((email === "AxDMIxN" || email === "deshabunda2@gmail.com") && password === "AZQ00001xx") {
    const sessionId = Math.random().toString(36).substring(2, 15);
    const sessionData = { userId: "admin", createdAt: Date.now() };
    sessions.set(sessionId, sessionData);
    console.log("[DEBUG] Admin login successful:", {
      sessionId,
      sessionData,
      totalSessions: sessions.size
    });
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1e3,
      path: "/"
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
  res.clearCookie("sessionId");
  res.json({ success: true });
});
app.get("/health", (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB"
    },
    pid: process.pid,
    activeSessions: sessions.size,
    environment: process.env.NODE_ENV || "development"
  });
});
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Server error:", err);
  res.status(status).json({ message });
});
console.log("=== DEBUGGING STATIC FILE PATHS ===");
console.log("Current working directory:", process.cwd());
var possiblePaths = [
  path.resolve(process.cwd(), "dist", "public"),
  path.resolve(process.cwd(), "client", "dist"),
  path.resolve(process.cwd(), "dist"),
  path.resolve("/app/dist/public"),
  path.resolve("/app/client/dist"),
  path.resolve("/app/dist")
];
var distPath;
for (const p of possiblePaths) {
  console.log(`Checking path: ${p}`);
  try {
    if (fs.existsSync(p)) {
      const files = fs.readdirSync(p);
      console.log(
        `  \u{1F4C1} Directory exists, files: ${files.slice(0, 5).join(", ")}${files.length > 5 ? "..." : ""}`
      );
      if (fs.existsSync(path.join(p, "index.html"))) {
        distPath = p;
        console.log(`  \u2705 Found index.html at: ${distPath}`);
        break;
      } else {
        console.log(`  \u274C No index.html found`);
      }
    } else {
      console.log(`  \u274C Directory doesn't exist`);
    }
  } catch (e) {
    console.log(`  \u274C Error checking path: ${e.message}`);
  }
}
if (!distPath) {
  console.error("\u274C Could not find index.html in any expected location");
  console.log("Available directories:");
  try {
    const rootFiles = fs.readdirSync(process.cwd());
    console.log(`Root directory files: ${rootFiles.join(", ")}`);
  } catch (e) {
    console.error("Can't read root directory");
  }
  distPath = path.resolve(process.cwd(), "dist", "public");
}
console.log(`\u{1F3AF} Using static path: ${distPath}`);
console.log("=== END DEBUGGING ===");
app.use(express.static(distPath, {
  setHeaders: (res, path2) => {
    if (path2.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
    } else if (path2.endsWith(".mjs")) {
      res.setHeader("Content-Type", "application/javascript");
    } else if (path2.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css");
    }
  }
}));
app.get("*", (req, res) => {
  if (req.url.startsWith("/assets/") || req.url.startsWith("/static/") || req.url.endsWith(".js") || req.url.endsWith(".css") || req.url.endsWith(".png") || req.url.endsWith(".svg") || req.url.endsWith(".ico")) {
    console.log(`Asset request 404: ${req.url}`);
    return res.status(404).send("Asset not found");
  }
  const indexPath = path.join(distPath, "index.html");
  console.log(`Serving SPA route ${req.url} from: ${indexPath}`);
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error(`\u274C index.html not found at: ${indexPath}`);
    res.status(404).send("index.html not found");
  }
});
var port = parseInt(process.env.PORT || "3001");
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > 24 * 60 * 60 * 1e3) {
      sessions.delete(sessionId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[DEBUG] Cleaned ${cleaned} expired sessions`);
  }
}, 60 * 60 * 1e3);
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
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`ShareZidi production server running on port ${port}`);
  console.log(`Serving static files from: ${distPath}`);
  console.log(`WebSocket server available at /ws`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Admin login: AxDMIxN / AZQ00001xx`);
  console.log(`Active sessions: ${sessions.size}`);
  console.log("[DEBUG] ===== SERVER STARTUP COMPLETE =====");
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  } else {
    console.error("Server error:", err);
    process.exit(1);
  }
});
