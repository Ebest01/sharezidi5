import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuthRoutes } from "./authRoutes";
import { GeolocationService } from "./services/geolocationService";
import { db } from "./db";
import { type InsertVisitor } from "../shared/schema";
import { generatePassword, extractUsernameFromEmail } from "./utils/passwordGenerator";
import { eq } from "drizzle-orm";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
      req.path.includes('.') || 
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
          await db.insert(visitors).values(visitorData);
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
  // Setup authentication routes first
  setupAuthRoutes(app);
  
  // Add database test endpoints
  app.post("/api/register", async (req, res) => {
    console.log("[REGISTER] ===== REGISTRATION REQUEST =====");
    console.log("[REGISTER] Request body:", req.body);
    
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email));
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "User already exists" });
      }
      
      // Generate password and username
      const password = generatePassword();
      const username = extractUsernameFromEmail(email);
      
      // Get location data
      const ip = GeolocationService.extractIPAddress(req);
      const locationData = await GeolocationService.getLocationData(ip);
      
      // Create user
      const [newUser] = await db.insert(users).values({
        email: email,
        username: username,
        password: password,
        transferCount: 0,
        isPro: false,
        sessionId: GeolocationService.generateSessionId(),
        ipAddress: ip,
        country: locationData?.country || null,
        countryCode: locationData?.country_code || null,
        region: locationData?.region || null,
        city: locationData?.city || null,
        timezone: locationData?.timezone || null,
        latitude: locationData?.latitude || null,
        longitude: locationData?.longitude || null,
        isp: locationData?.isp || null,
        userAgent: req.headers['user-agent'] || null,
        referrer: req.headers.referer || null
      }).returning();
      
      console.log("[REGISTER] ✅ User created successfully:", email);
      console.log("[REGISTER] Generated password:", password);
      
      res.json({
        success: true,
        user: newUser,
        message: "Registration successful"
      });
      
    } catch (error) {
      console.error("[REGISTER] Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });
  
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

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
