import express from "express";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { FileTransferService } from "./services/fileTransferService.js";
import session from "express-session";
import connectPg from "connect-pg-simple";
import fs from "fs";
import bcrypt from "bcrypt";
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "../shared/schema.js";
import { eq } from "drizzle-orm";

// Database setup
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Session configuration
const PostgresSessionStore = connectPg(session);
app.use(session({
  store: new PostgresSessionStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'production-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Test database connection
console.log("[DATABASE] Testing connection...");
pool.query('SELECT 1 as test').then(result => {
  console.log("[DATABASE] Connection successful:", result.rows[0]);
}).catch(error => {
  console.error("[DATABASE] Connection failed:", error);
});

// Admin login endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("[DEBUG] Login attempt:", { email, hasPassword: !!password });

    // Special admin login
    if (email === "AxDMIxN" && password === "AZQ00001xx") {
      console.log("[Admin] Admin login detected");

      // Check if admin user exists
      let adminUser;
      try {
        const [user] = await db.select().from(schema.users).where(eq(schema.users.email, "deshabunda2@gmail.com"));
        adminUser = user;
        console.log("[DATABASE] Admin user found:", adminUser ? { id: adminUser.id, username: adminUser.username } : "NOT FOUND");
      } catch (dbError) {
        console.error("[DATABASE] Error checking admin user:", dbError);
      }

      if (!adminUser) {
        // Create admin user
        console.log("[Admin] Creating new admin user");
        const hashedPassword = await bcrypt.hash("AZQ00001xx", 10);
        try {
          const [newUser] = await db.insert(schema.users).values({
            email: "deshabunda2@gmail.com",
            password: hashedPassword,
            username: "AxDMIxN",
            transferCount: 0,
            isPro: true,
            subscriptionDate: new Date(),
            lastResetDate: new Date(),
            ipAddress: req.ip || "127.0.0.1",
            country: "Development",
            city: "Admin Console",
          }).returning();
          adminUser = newUser;
          console.log("[Admin] Created admin user with ID:", adminUser.id);
        } catch (createError) {
          console.error("[Admin] Error creating admin user:", createError);
          return res.status(500).json({ error: "Failed to create admin user" });
        }
      }

      // Store in session
      (req.session as any).userId = adminUser.id;
      console.log("[DEBUG] Admin stored in session with ID:", adminUser.id);

      // Return admin data
      const { password: _, ...userWithoutPassword } = adminUser;
      console.log("[DEBUG] Returning admin user:", { id: userWithoutPassword.id, username: userWithoutPassword.username });
      return res.json({
        message: "Admin login successful",
        user: userWithoutPassword,
      });
    }

    res.status(401).json({ error: "Invalid credentials" });
  } catch (error) {
    console.error("[Login] Error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user endpoint
app.get("/api/auth/user", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId;
    console.log("[Auth Check] Session user ID:", userId);

    if (!userId) {
      console.log("[Auth Check] No userId in session");
      return res.status(401).json({ error: "Not authenticated" });
    }

    console.log("[Auth Check] Looking up user:", userId);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    
    if (!user) {
      console.log("[Auth Check] User not found in database");
      return res.status(401).json({ error: "User not found" });
    }

    console.log("[Auth Check] User found:", { id: user.id, username: user.username, email: user.email });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("[Auth Check] Error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// Other auth endpoints
app.post("/api/auth/register", (req, res) => {
  res.json({ success: true, message: "Registration disabled in production" });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// WebSocket and file transfer setup
const httpServer = createServer(app);
const fileTransferService = new FileTransferService();
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws: WebSocket, request) => {
  const userId = Math.random().toString(36).substring(2, 8);
  console.log(`[WebSocket] New connection: ${userId}`);
  fileTransferService.registerUser(userId, ws);

  ws.on("close", () => {
    fileTransferService.unregisterUser(userId);
  });

  ws.on("error", (error) => {
    console.error(`[WebSocket] Error:`, error);
    fileTransferService.unregisterUser(userId);
  });
});

// Static file serving
const distPath = path.resolve(process.cwd(), "dist", "public");
console.log(`[Static] Serving from: ${distPath}`);

app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Catch-all handler
app.get('*', (req, res) => {
  // Don't serve index.html for API routes or assets
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/assets/') || 
      req.path.includes('.')) {
    return res.status(404).send('Not Found');
  }
  
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built');
  }
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`[Server] Production server running on port ${PORT}`);
});