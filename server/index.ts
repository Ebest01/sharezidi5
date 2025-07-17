import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
// DISABLED: import { setupAuthRoutes } from "./authRoutes"; // Has conflicting login endpoint
import { GeolocationService } from "./services/geolocationService";
import { connectMongoDB } from "./db";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import session from "express-session";

// User Schema compatible with production system
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  transferCount: { type: Number, default: 0 },
  isPro: { type: Boolean, default: false },
  subscriptionDate: { type: Date, default: Date.now },
  lastResetDate: { type: Date, default: Date.now },
  lastVisitTime: { type: Date, default: Date.now },
  totalFilesTransferred: { type: Number, default: 0 },
  totalBytesTransferred: { type: Number, default: 0 },
  deviceCount: { type: Number, default: 0 },
  // Geolocation fields
  ipAddress: String,
  country: String,
  countryCode: String,
  region: String,
  city: String,
  timezone: String,
  latitude: String,
  longitude: String,
  isp: String
}, { timestamps: true });

// Visitor Schema compatible with production system  
const visitorSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  ipAddress: { type: String, required: true },
  userAgent: String,
  lastVisitTime: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 1 },
  pageViews: { type: Number, default: 1 },
  sessionDuration: { type: Number, default: 0 },
  country: String,
  countryCode: String,
  region: String,
  city: String,
  timezone: String,
  latitude: String,
  longitude: String,
  isp: String,
  referrer: String,
  visitedAt: { type: Date, default: Date.now }
});

// Check if models already exist before creating them
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Visitor = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);
import { generatePassword, extractUsernameFromEmail } from "./utils/passwordGenerator";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration for authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'sharezidi-dev-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  name: 'sharezidi.session',
  cookie: { 
    secure: false, // Disable for now to test - will re-enable with proper HTTPS setup
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Required for cross-origin cookies
  }
}));

// Add proper cache control and MIME type headers for static assets
app.use((req, res, next) => {
  // Set proper MIME types for JavaScript modules
  if (req.path.endsWith('.js') || req.path.includes('.js?')) {
    res.setHeader('Content-Type', 'application/javascript');
  }
  
  // Prevent caching issues with module scripts
  if (req.path.includes('.js') && req.path.includes('-')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
});

// IMMEDIATE GEOLOCATION TRACKING - First thing that happens when visitor hits server
// This is equivalent to placing PHP code above <html> tag
// Includes circuit breaker pattern to prevent system overload

let geoFailureCount = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIME = 30000; // 30 seconds

app.use(async (req, res, next) => {
  // Skip tracking for API calls, static assets, and WebSocket upgrades
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/@') ||  // Vite dev server assets
      req.path.includes('.js') ||   // JavaScript files
      req.path.includes('.css') ||  // CSS files
      req.path.includes('.png') ||  // Images
      req.path.includes('.jpg') ||
      req.path.includes('.jpeg') ||
      req.path.includes('.gif') ||
      req.path.includes('.svg') ||
      req.path.includes('.ico') ||  // Favicon
      req.path.includes('.woff') || // Fonts
      req.path.includes('.woff2') ||
      req.path.includes('.ttf') ||
      req.path.includes('.eot') ||
      req.path === '/ws' ||
      req.headers.upgrade === 'websocket') {
    return next();
  }

  // Circuit breaker: Skip geolocation if too many recent failures
  const now = Date.now();
  if (geoFailureCount >= FAILURE_THRESHOLD && (now - lastFailureTime) < CIRCUIT_RESET_TIME) {
    // Continue without geolocation tracking to ensure page loads normally
    return next();
  }

  // Reset circuit breaker if enough time has passed
  if ((now - lastFailureTime) >= CIRCUIT_RESET_TIME) {
    geoFailureCount = 0;
  }

  // Capture visitor data immediately (non-blocking)
  setImmediate(async () => {
    try {
      const ip = GeolocationService.extractIPAddress(req);
      const userAgent = req.headers['user-agent'] || '';
      const referrer = req.headers.referer || '';
      
      // Always log basic visitor info even if geolocation fails
      console.log(`[Visitor] ${ip} requesting ${req.path}`);

      // Get geolocation data with timeout protection
      const locationData = await Promise.race([
        GeolocationService.getLocationData(ip),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Overall timeout')), 5000)
        )
      ]) as any;

      if (locationData) {
        const visitorData: InsertVisitor = {
          sessionId: GeolocationService.generateSessionId(),
          ipAddress: ip,
          userAgent,
          country: locationData.country || 'Unknown',
          countryCode: locationData.country_code || 'XX',
          region: locationData.region || 'Unknown',
          city: locationData.city || 'Unknown',
          timezone: locationData.timezone || 'UTC',
          latitude: locationData.latitude || '0',
          longitude: locationData.longitude || '0',
          isp: locationData.isp || 'Unknown',
          referrer
        };

        // Save to database with additional error protection
        try {
          const visitor = new Visitor(visitorData);
          await visitor.save();
          // Reset failure count on success
          geoFailureCount = 0;
        } catch (dbError) {
          throw new Error(`Database save failed: ${dbError}`);
        }
      }
    } catch (error) {
      // Track failures for circuit breaker
      geoFailureCount++;
      lastFailureTime = Date.now();
      
      // Silent failure - don't impact user experience
      // Only log critical errors
      if (geoFailureCount === 1) {
        console.warn('[Geolocation] Service degraded, switching to minimal tracking');
      }
    }
  });

  // ALWAYS continue with page rendering immediately
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize MongoDB connection first
  try {
    await connectMongoDB();
    console.log("[STARTUP] ✅ MongoDB connected successfully");
  } catch (error) {
    console.error("[STARTUP] ❌ MongoDB connection failed:", error.message);
    console.log("[STARTUP] 🔄 Continuing with degraded functionality - database features disabled");
    // Don't exit, continue with basic functionality
  }
  
  // Auth status endpoint for frontend - EARLY registration to avoid conflicts
  app.get("/api/auth/user", async (req, res) => {
    console.log("[AUTH] Frontend requesting user authentication status");
    
    const userId = (req.session as any)?.userId;
    if (!userId) {
      console.log("[AUTH] No user session found");
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const user = await User.findById(userId);
      if (!user) {
        console.log("[AUTH] User not found in database:", userId);
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      console.log("[AUTH] ✅ User authenticated:", user.email);
      res.json({
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        transferCount: user.transferCount,
        isPro: user.isPro,
        isGuest: false
      });
      
    } catch (error) {
      console.error("[AUTH] Error checking user session:", error);
      res.status(401).json({ error: "Not authenticated" });
    }
  });
  
  // Auth logout endpoint matching frontend expectations
  app.post("/api/auth/logout", (req, res) => {
    console.log("[AUTH LOGOUT] User logout request");
    
    const userId = (req.session as any)?.userId;
    if (userId) {
      console.log("[AUTH LOGOUT] Clearing session for user:", userId);
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error("[AUTH LOGOUT] Error destroying session:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      
      console.log("[AUTH LOGOUT] ✅ Session destroyed successfully");
      res.json({ success: true, message: "Logged out successfully" });
    });
  });
  
  // Add database test endpoints
  app.post("/api/register", async (req, res) => {
    console.log("[REGISTER] ===== REGISTRATION REQUEST =====");
    console.log("[REGISTER] Request body:", req.body);
    
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      // Check if MongoDB is connected
      if (mongoose.connection.readyState !== 1) {
        console.log("[REGISTER] MongoDB not connected, registration unavailable");
        return res.status(503).json({ error: "Database unavailable - please try again later" });
      }
      
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }
      
      // Generate password and username
      const password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);
      const username = extractUsernameFromEmail(email);
      
      // Get location data
      const ip = GeolocationService.extractIPAddress(req);
      const locationData = await GeolocationService.getLocationData(ip);
      
      // Create user
      const newUser = new User({
        email: email,
        username: username,
        password: hashedPassword,
        transferCount: 0,
        isPro: false,
        ipAddress: ip,
        country: locationData?.country || null,
        countryCode: locationData?.country_code || null,
        region: locationData?.region || null,
        city: locationData?.city || null,
        timezone: locationData?.timezone || null,
        latitude: locationData?.latitude || null,
        longitude: locationData?.longitude || null,
        isp: locationData?.isp || null
      });
      
      await newUser.save();
      
      console.log("[REGISTER] ✅ User created successfully:", email);
      console.log("[REGISTER] Generated password:", password);
      
      res.json({
        success: true,
        user: newUser,
        generatedPassword: password,
        message: "Registration successful"
      });
      
    } catch (error) {
      console.error("[REGISTER] Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });
  
  // SIMPLIFIED LOGIN - works with any password format
  app.post("/api/login", async (req, res) => {
    console.log("[SIMPLE LOGIN] ===== STARTING SIMPLE LOGIN =====");
    
    try {
      const { email, password } = req.body;
      console.log("[SIMPLE LOGIN] Email:", email, "Password:", password);
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        console.log("[SIMPLE LOGIN] ❌ User not found:", email);
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      console.log("[SIMPLE LOGIN] ✅ User found:", user.email);
      console.log("[SIMPLE LOGIN] Stored password hash:", user.password.substring(0, 20) + "...");
      console.log("[SIMPLE LOGIN] Provided password:", password);
      
      let loginSuccess = false;
      
      // Check hash format to determine verification method
      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
        // BCrypt hash format
        console.log("[SIMPLE LOGIN] Detected BCrypt hash, using BCrypt verification");
        try {
          loginSuccess = await bcrypt.compare(password, user.password);
          console.log("[SIMPLE LOGIN] BCrypt check result:", loginSuccess);
        } catch (error) {
          console.log("[SIMPLE LOGIN] BCrypt verification failed:", error);
        }
      } else {
        console.log("[SIMPLE LOGIN] Non-BCrypt hash detected, likely legacy format");
        console.log("[SIMPLE LOGIN] Hash format:", user.password.substring(0, 10) + "...");
        
        // This user has a legacy hash - let's update their password to BCrypt format
        console.log("[SIMPLE LOGIN] Updating user to BCrypt format...");
        
        // Try different legacy hash formats for backward compatibility
        console.log("[SIMPLE LOGIN] Trying legacy hash formats...");
        
        // Method 1: Direct comparison (for very old plain text passwords)
        if (password === user.password) {
          console.log("[SIMPLE LOGIN] ✅ Direct comparison successful, updating to BCrypt");
          loginSuccess = true;
        }
        // Method 2: Try scrypt format (hex.salt format)
        else if (user.password.includes('.') && user.password.length > 50) {
          try {
            const [hashed, salt] = user.password.split('.');
            const crypto = require('crypto');
            const { promisify } = require('util');
            const scryptAsync = promisify(crypto.scrypt);
            
            const hashedBuf = Buffer.from(hashed, 'hex');
            const suppliedBuf = await scryptAsync(password, salt, 64);
            loginSuccess = crypto.timingSafeEqual(hashedBuf, suppliedBuf);
            console.log("[SIMPLE LOGIN] Scrypt verification result:", loginSuccess);
            
            if (loginSuccess) {
              console.log("[SIMPLE LOGIN] ✅ Scrypt verification successful");
            }
          } catch (error) {
            console.log("[SIMPLE LOGIN] Scrypt verification failed:", error.message);
          }
        }
        
        // If login successful, upgrade password to BCrypt format
        if (loginSuccess) {
          console.log("[SIMPLE LOGIN] Upgrading password to BCrypt format...");
          const newHashedPassword = await bcrypt.hash(password, 10);
          await User.findByIdAndUpdate(user._id, { password: newHashedPassword });
          console.log("[SIMPLE LOGIN] ✅ Password upgraded to BCrypt format");
        } else {
          console.log("[SIMPLE LOGIN] ❌ All legacy verification methods failed");
        }
      }
      
      if (!loginSuccess) {
        console.log("[SIMPLE LOGIN] ❌ Login failed for:", email);
        return res.status(401).json({ 
          error: "The password you entered is incorrect. Please check your email for the auto-generated password, or use 'Forgot Password' to get a new one.",
          details: "Password mismatch"
        });
      }
      
      console.log("[SIMPLE LOGIN] ✅ LOGIN SUCCESS for:", email);
      
      // Update last visit time
      user.lastVisitTime = new Date();
      await user.save();
      
      // Store user in session
      (req.session as any).userId = user._id.toString();
      console.log("[SIMPLE LOGIN] Stored user in session:", user._id.toString());
      
      res.json({
        success: true,
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          transferCount: user.transferCount,
          isPro: user.isPro,
          isGuest: false
        },
        message: "Login successful"
      });
      
    } catch (error) {
      console.error("[SIMPLE LOGIN] Error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  // Logout endpoint
  app.post("/api/logout", async (req, res) => {
    console.log("[LOGOUT] User logout request");
    
    const userId = (req.session as any)?.userId;
    if (userId) {
      console.log("[LOGOUT] Clearing session for user:", userId);
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error("[LOGOUT] Error destroying session:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      
      console.log("[LOGOUT] ✅ Session destroyed successfully");
      res.json({ success: true, message: "Logged out successfully" });
    });
  });

  // Authentication status endpoint
  app.get('/api/auth/user', async (req, res) => {
    console.log("[AUTH] Frontend requesting user authentication status");
    
    try {
      const userId = (req.session as any)?.userId;
      console.log("[AUTH] Session userId:", userId);
      
      if (!userId) {
        console.log("[AUTH] No user session found");
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await User.findById(userId);
      if (!user) {
        console.log("[AUTH] User not found in database:", userId);
        return res.status(401).json({ error: "User not found" });
      }

      console.log("[AUTH] ✅ User authenticated:", user.email);
      res.json({
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        transferCount: user.transferCount,
        isPro: user.isPro,
        isGuest: false
      });
    } catch (error) {
      console.error('[AUTH] User fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });
  

  
  app.get("/api/dbtest/users", async (req, res) => {
    console.log("[DBTEST] ===== FETCHING ALL USERS =====");
    
    try {
      const allUsers = await User.find({}, {
        _id: 1,
        email: 1,
        username: 1,
        transferCount: 1,
        isPro: 1,
        createdAt: 1,
        country: 1,
        city: 1
      }).sort({ createdAt: 1 });
      
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

  app.get("/api/dbtest/connection-info", async (req, res) => {
    console.log("[DBTEST] ===== FETCHING CONNECTION INFO =====");
    
    try {
      res.json({
        success: true,
        connectionState: mongoose.connection.readyState,
        databaseName: mongoose.connection.db?.databaseName || 'Not connected',
        host: mongoose.connection.host || 'Not connected',
        port: mongoose.connection.port || 'Not connected',
        collections: mongoose.connection.db ? await mongoose.connection.db.listCollections().toArray() : []
      });
      
    } catch (error) {
      console.error("[DBTEST] Error fetching connection info:", error);
      res.status(500).json({ error: "Failed to fetch connection info" });
    }
  });
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT from environment in production, fallback to 5000 for development
  const port = process.env.PORT || 5000;
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  
  const httpServer = server.listen({
    port: parseInt(port.toString()),
    host,
    reusePort: true,
  }, () => {
    log(`serving on ${host}:${port}`);
  });

  // Handle graceful shutdown for production
  process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] Received SIGTERM, shutting down gracefully...');
    httpServer.close(() => {
      console.log('[SHUTDOWN] HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[SHUTDOWN] Received SIGINT, shutting down gracefully...');
    httpServer.close(() => {
      console.log('[SHUTDOWN] HTTP server closed');
      process.exit(0);
    });
  });
})();
