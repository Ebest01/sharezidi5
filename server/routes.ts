import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { FileTransferService } from "./services/fileTransferService";
import { GeolocationService } from "./services/geolocationService";
import { visitors, type InsertVisitor } from "@shared/schema";
import { db } from "./db";
import QRCode from 'qrcode';
import { networkInterfaces } from 'os';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize file transfer service
  const fileTransferService = new FileTransferService();

  // Visitor tracking middleware
  app.use(async (req, res, next) => {
    // Skip tracking for API calls and static files
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
      return next();
    }

    try {
      const ip = GeolocationService.extractIPAddress(req);
      const sessionId = req.session?.id || GeolocationService.generateSessionId();
      const userAgent = req.headers['user-agent'] || '';
      const referrer = req.headers.referer || '';

      // Get geolocation data
      const locationData = await GeolocationService.getLocationData(ip);

      if (locationData) {
        const visitorData: InsertVisitor = {
          sessionId,
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

        // Insert visitor data (fire and forget)
        db.insert(visitors).values(visitorData).catch(error => {
          console.warn('[Geolocation] Failed to save visitor data:', error);
        });

        console.log(`[Visitor] ${ip} from ${locationData.city}, ${locationData.country}`);
      }
    } catch (error) {
      console.warn('[Geolocation] Visitor tracking failed:', error);
    }

    next();
  });

  // API endpoint to generate QR code
  app.post('/api/generate-qr', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      res.send(qrCodeDataUrl);
    } catch (error) {
      console.error('QR code generation failed:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });

  // API endpoint to get local network IPs
  app.get('/api/network-info', (req, res) => {
    try {
      const interfaces = networkInterfaces();
      const ips: string[] = [];
      
      Object.values(interfaces).forEach(networkInterface => {
        networkInterface?.forEach(details => {
          if (details.family === 'IPv4' && !details.internal) {
            ips.push(details.address);
          }
        });
      });

      const port = process.env.PORT || 5000;
      const urls = ips.map(ip => `http://${ip}:${port}`);
      
      res.json({ 
        urls,
        currentHost: req.get('host'),
        port 
      });
    } catch (error) {
      console.error('Network info failed:', error);
      res.status(500).json({ error: 'Failed to get network info' });
    }
  });

  // API endpoint for visitor analytics
  app.get('/api/analytics/visitors', async (req, res) => {
    try {
      // Get visitor stats
      const [totalVisitors] = await db.execute(`SELECT COUNT(*) as count FROM visitors`);
      const [uniqueIPs] = await db.execute(`SELECT COUNT(DISTINCT ip_address) as count FROM visitors`);
      const [topCountries] = await db.execute(`
        SELECT country, country_code, COUNT(*) as visits 
        FROM visitors 
        WHERE country IS NOT NULL AND country != '' 
        GROUP BY country, country_code 
        ORDER BY visits DESC 
        LIMIT 10
      `);
      const [topCities] = await db.execute(`
        SELECT city, country, COUNT(*) as visits 
        FROM visitors 
        WHERE city IS NOT NULL AND city != '' 
        GROUP BY city, country 
        ORDER BY visits DESC 
        LIMIT 10
      `);
      const [recentVisitors] = await db.execute(`
        SELECT ip_address, country, city, user_agent, visited_at 
        FROM visitors 
        ORDER BY visited_at DESC 
        LIMIT 20
      `);

      res.json({
        summary: {
          totalVisitors: totalVisitors.count,
          uniqueIPs: uniqueIPs.count
        },
        topCountries,
        topCities,
        recentVisitors
      });
    } catch (error) {
      console.error('Analytics fetch failed:', error);
      res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
  });

  // Create WebSocket server on /ws path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    perMessageDeflate: false
  });

  wss.on('connection', (ws: WebSocket, request) => {
    console.log('[WebSocket] New connection from:', request.socket.remoteAddress);
    
    let userId: string | null = null;
    let isRegistered = false;

    // Auto-register user immediately on connection
    userId = Math.random().toString(36).substring(2, 8);
    
    // Get device info from user agent
    const userAgent = request.headers['user-agent'] || '';
    let deviceName = 'Unknown Device';
    
    if (userAgent.includes('Windows')) deviceName = 'Windows PC';
    else if (userAgent.includes('Macintosh')) deviceName = 'Mac';
    else if (userAgent.includes('iPhone')) deviceName = 'iPhone';
    else if (userAgent.includes('iPad')) deviceName = 'iPad';
    else if (userAgent.includes('Android')) deviceName = 'Android Device';
    else if (userAgent.includes('Linux')) deviceName = 'Linux PC';
    
    isRegistered = true;
    
    // Register user (this will send registration confirmation)
    fileTransferService.registerUser(userId, ws, deviceName);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        fileTransferService.handleMessage(userId, message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      if (userId && isRegistered) {
        fileTransferService.unregisterUser(userId);
      }
      console.log('[WebSocket] Connection closed');
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
    });

    // Send ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  });

  return httpServer;
}
