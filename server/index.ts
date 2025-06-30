import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { GeolocationService } from "./services/geolocationService";
import { db } from "./db";
import { visitors, type InsertVisitor } from "@shared/schema";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// IMMEDIATE GEOLOCATION TRACKING - First thing that happens when visitor hits server
// This is equivalent to placing PHP code above <html> tag
app.use(async (req, res, next) => {
  // Skip tracking for API calls, static assets, and WebSocket upgrades
  if (req.path.startsWith('/api/') || 
      req.path.includes('.') || 
      req.path === '/ws' ||
      req.headers.upgrade === 'websocket') {
    return next();
  }

  // Capture visitor data immediately
  setImmediate(async () => {
    try {
      const ip = GeolocationService.extractIPAddress(req);
      const userAgent = req.headers['user-agent'] || '';
      const referrer = req.headers.referer || '';
      
      console.log(`[Visitor] Immediate capture: ${ip} requesting ${req.path}`);

      // Get geolocation data (this happens in background)
      const locationData = await GeolocationService.getLocationData(ip);

      if (locationData) {
        const visitorData: InsertVisitor = {
          sessionId: GeolocationService.generateSessionId(),
          ipAddress: ip,
          userAgent,
          country: locationData.country || '',
          countryCode: locationData.country_code || '',
          region: locationData.region || '',
          city: locationData.city || '',
          timezone: locationData.timezone || '',
          latitude: locationData.latitude || '',
          longitude: locationData.longitude || '',
          isp: locationData.isp || '',
          referrer
        };

        // Save to database (fire and forget - won't block page loading)
        db.insert(visitors).values(visitorData).catch(error => {
          console.warn('[Geolocation] Failed to save visitor data:', error);
        });

        console.log(`[Visitor] Captured: ${ip} from ${locationData.city}, ${locationData.country}`);
      }
    } catch (error) {
      console.warn('[Geolocation] Immediate tracking failed:', error);
    }
  });

  // Continue with page rendering immediately (don't wait for geolocation)
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
