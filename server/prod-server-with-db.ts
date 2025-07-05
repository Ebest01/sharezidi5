import express from "express";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { FileTransferService } from "./services/fileTransferService.js";
import { GeolocationService } from "./services/geolocationService.js";
import { db } from "./db.js";
import { visitors, users, type InsertVisitor } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generatePassword, extractUsernameFromEmail, validateEmail } from "./utils/passwordGenerator.js";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import fs from "fs";

const scryptAsync = promisify(scrypt);

// Password hashing functions
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

console.log("[DEBUG] ===== PRODUCTION SERVER WITH DATABASE STARTING =====");
console.log("[DEBUG] Environment:", {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL_EXISTS: !!process.env.DATABASE_URL
});

// Test database connection
async function testDatabaseConnection() {
  try {
    console.log("[DATABASE] Testing PostgreSQL connection...");
    const result = await db.execute("SELECT 1 as test");
    console.log("[DATABASE] ✅ PostgreSQL connection successful:", result);
    
    // Test users table access
    const userCount = await db.select().from(users).limit(1);
    console.log("[DATABASE] ✅ Users table accessible, sample data:", userCount.length > 0 ? userCount[0] : "No users yet");
    
    return true;
  } catch (error) {
    console.error("[DATABASE] ❌ PostgreSQL connection failed:", error);
    return false;
  }
}

// Request logging with visitor tracking
app.use(async (req, res, next) => {
  const start = Date.now();
  const ip = GeolocationService.extractIPAddress(req);
  
  // Log visitor if it's a page request (not API or asset)
  if (!req.url.startsWith('/api/') && !req.url.startsWith('/assets/') && !req.url.includes('.')) {
    try {
      const locationData = await GeolocationService.getLocationData(ip);
      const visitorData: InsertVisitor = {
        sessionId: GeolocationService.generateSessionId(),
        ipAddress: ip,
        userAgent: req.get('User-Agent') || '',
        referer: req.get('Referer') || '',
        requestPath: req.url,
        country: locationData?.country || 'Unknown',
        countryCode: locationData?.country_code || '',
        region: locationData?.region || '',
        city: locationData?.city || '',
        timezone: locationData?.timezone || '',
        latitude: locationData?.latitude || '',
        longitude: locationData?.longitude || '',
        isp: locationData?.isp || '',
      };
      
      await db.insert(visitors).values(visitorData);
      console.log(`[Visitor] ${ip} from ${visitorData.city}, ${visitorData.country} requesting ${req.url}`);
    } catch (error) {
      console.log(`[Visitor] ${ip} requesting ${req.url} (geolocation failed)`);
    }
  }

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

// Database-backed authentication endpoints
app.get("/api/auth/user", async (req, res) => {
  console.log("[DEBUG] ===== AUTH CHECK START =====");
  
  const sessionId = req.headers.authorization?.replace("Bearer ", "") || 
                   req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1];
  
  console.log("[DEBUG] Session lookup:", {
    sessionId,
    cookieHeader: req.headers.cookie,
    authHeader: req.headers.authorization
  });

  try {
    if (sessionId) {
      // Try to find user by session ID in database  
      const user = await db.select().from(users).where(eq(users.username, sessionId)).limit(1);
      
      if (user.length > 0) {
        console.log("[DEBUG] ✅ Database user found:", user[0].email);
        console.log("[DEBUG] ===== AUTH CHECK END (DATABASE USER) =====");
        return res.json({
          id: user[0].id.toString(),
          email: user[0].email,
          username: user[0].username,
          transferCount: user[0].transferCount,
          isPro: user[0].isPro,
          isGuest: false
        });
      }
    }
    
    // Return guest user if no valid session
    console.log("[DEBUG] No valid session - returning guest");
    console.log("[DEBUG] ===== AUTH CHECK END (GUEST) =====");
    res.json({
      id: "guest",
      email: "guest@sharezidi.com",
      transferCount: 0,
      isPro: false,
      isGuest: true
    });
  } catch (error) {
    console.error("[DEBUG] Database error in auth check:", error);
    console.log("[DEBUG] ===== AUTH CHECK END (ERROR - GUEST) =====");
    res.json({
      id: "guest",
      email: "guest@sharezidi.com",
      transferCount: 0,
      isPro: false,
      isGuest: true
    });
  }
});

// Registration endpoint - email only, auto-generate password
app.post("/api/register", async (req, res) => {
  console.log("[REGISTER] ===== REGISTRATION START =====");
  
  try {
    const { email } = req.body;
    
    if (!email || !validateEmail(email)) {
      console.log("[REGISTER] Invalid email:", email);
      return res.status(400).json({ error: "Valid email is required" });
    }
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      console.log("[REGISTER] User already exists:", email);
      return res.status(400).json({ error: "User with this email already exists" });
    }
    
    // Generate password and create user
    const generatedPassword = generatePassword();
    const hashedPassword = await hashPassword(generatedPassword);
    const username = extractUsernameFromEmail(email);
    
    // Get geolocation data
    const ip = GeolocationService.extractIPAddress(req);
    const locationData = await GeolocationService.getLocationData(ip);
    
    const newUser = await db.insert(users).values({
      email,
      username,
      password: hashedPassword,
      transferCount: 0,
      isPro: false,
      ipAddress: ip,
      country: locationData?.country || 'Unknown',
      countryCode: locationData?.country_code || '',
      region: locationData?.region || '',
      city: locationData?.city || '',
      timezone: locationData?.timezone || '',
      latitude: locationData?.latitude || '',
      longitude: locationData?.longitude || '',
      isp: locationData?.isp || ''
    }).returning();
    
    console.log("[REGISTER] ✅ User created successfully:", email);
    console.log("[REGISTER] Generated password:", generatedPassword);
    console.log("[REGISTER] ===== REGISTRATION END =====");
    
    res.status(201).json({
      success: true,
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        username: newUser[0].username
      },
      generatedPassword: generatedPassword,
      message: "Registration successful! Please save your password."
    });
    
  } catch (error) {
    console.error("[REGISTER] Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  console.log("[LOGIN] ===== LOGIN START =====");
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log("[LOGIN] Missing email or password");
      return res.status(400).json({ error: "Email and password are required" });
    }
    
    // Find user by email
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (user.length === 0) {
      console.log("[LOGIN] User not found:", email);
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    // Verify password
    const passwordMatch = await comparePasswords(password, user[0].password || '');
    
    if (!passwordMatch) {
      console.log("[LOGIN] Invalid password for:", email);
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    console.log("[LOGIN] ✅ Login successful:", email);
    console.log("[LOGIN] ===== LOGIN END =====");
    
    res.json({
      success: true,
      user: {
        id: user[0].id.toString(),
        email: user[0].email,
        username: user[0].username,
        transferCount: user[0].transferCount,
        isPro: user[0].isPro,
        isGuest: false
      },
      sessionToken: user[0].username // Use username as session token for simplicity
    });
    
  } catch (error) {
    console.error("[LOGIN] Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Database test endpoint - get all users
app.get("/api/dbtest/users", async (req, res) => {
  console.log("[DBTEST] ===== FETCHING ALL USERS =====");
  
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      transferCount: users.transferCount,
      isPro: users.isPro,
      createdAt: users.createdAt,
      country: users.country,
      city: users.city
    }).from(users).orderBy(users.createdAt);
    
    console.log(`[DBTEST] ✅ Found ${allUsers.length} users in database`);
    
    res.json({
      success: true,
      count: allUsers.length,
      users: allUsers
    });
    
  } catch (error) {
    console.error("[DBTEST] Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users from database" });
  }
});

// Health check endpoint
app.get("/health", async (req, res) => {
  const dbStatus = await testDatabaseConnection();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus ? "connected" : "disconnected",
    connectedDevices: fileTransferService.getConnectedUserCount?.() || 0
  });
});

// Analytics endpoint (database-powered)
app.get("/api/analytics", async (req, res) => {
  try {
    const totalVisitors = await db.select().from(visitors);
    const totalUsers = await db.select().from(users);
    
    // Group by country
    const countryStats = totalVisitors.reduce((acc, visitor) => {
      const country = visitor.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      totalVisitors: totalVisitors.length,
      totalUsers: totalUsers.length,
      countryBreakdown: Object.entries(countryStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([country, count]) => ({ country, count })),
      recentVisitors: totalVisitors
        .slice(-10)
        .map(v => ({
          city: v.city,
          country: v.country,
          timestamp: v.createdAt,
          path: v.requestPath
        }))
    });
  } catch (error) {
    console.error("[Analytics] Database error:", error);
    res.status(500).json({ error: "Analytics unavailable" });
  }
});

// Static file serving
const publicPath = path.join(process.cwd(), "dist", "public");
console.log("[DEBUG] Serving static files from:", publicPath);

// Serve static assets
app.use("/assets", (req, res, next) => {
  const assetPath = path.join(publicPath, "assets", req.url);
  
  if (!fs.existsSync(assetPath)) {
    console.log(`Asset request 404: ${req.url}`);
    return res.status(404).send("Asset not found");
  }
  
  res.sendFile(assetPath);
});

// SPA routing - serve index.html for all non-API routes
app.get("*", (req, res) => {
  const indexPath = path.join(publicPath, "index.html");
  console.log(`Serving SPA route ${req.url} from: ${indexPath}`);
  res.sendFile(indexPath);
});

const PORT = process.env.PORT || 5000;

// Start server with database connection test
async function startServer() {
  const dbConnected = await testDatabaseConnection();
  
  if (!dbConnected) {
    console.warn("[WARNING] Starting server without database connection");
  }
  
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] ShareZidi production server running on port ${PORT}`);
    console.log(`[SERVER] Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`[SERVER] WebSocket: ✅ Ready on /ws`);
  });
}

startServer().catch(console.error);