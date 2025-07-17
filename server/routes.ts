import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { FileTransferService } from "./services/fileTransferService";
import { GeolocationService } from "./services/geolocationService";
import { generateDeviceId } from "./utils/passwordGenerator";
import { visitors, type InsertVisitor } from "@shared/schema";
import { db } from "./db";
import QRCode from 'qrcode';
import { networkInterfaces } from 'os';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize file transfer service
  const fileTransferService = new FileTransferService();



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

  // API endpoint for visitor analytics with comprehensive error handling
  app.get('/api/analytics/visitors', async (req, res) => {
    try {
      // Set response timeout to prevent hanging requests
      const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({ error: 'Request timeout' });
        }
      }, 10000);

      // Get visitor stats with fallback values
      let summary = { totalVisitors: 0, uniqueIPs: 0 };
      let topCountries: any[] = [];
      let topCities: any[] = [];
      let recentVisitors: any[] = [];

      try {
        const totalVisitorsResult = await db.execute(`SELECT COUNT(*) as count FROM visitors`);
        summary.totalVisitors = parseInt(totalVisitorsResult.rows[0]?.count as string) || 0;
      } catch (error) {
        console.warn('[Analytics] Failed to get total visitors:', error);
      }

      try {
        const uniqueIPsResult = await db.execute(`SELECT COUNT(DISTINCT ip_address) as count FROM visitors`);
        summary.uniqueIPs = parseInt(uniqueIPsResult.rows[0]?.count as string) || 0;
      } catch (error) {
        console.warn('[Analytics] Failed to get unique IPs:', error);
      }

      try {
        const topCountriesResult = await db.execute(`
          SELECT country, country_code, COUNT(*) as visits 
          FROM visitors 
          WHERE country IS NOT NULL AND country != '' AND country != 'Unknown'
          GROUP BY country, country_code 
          ORDER BY visits DESC 
          LIMIT 10
        `);
        topCountries = topCountriesResult.rows || [];
      } catch (error) {
        console.warn('[Analytics] Failed to get top countries:', error);
      }

      try {
        const topCitiesResult = await db.execute(`
          SELECT city, country, COUNT(*) as visits 
          FROM visitors 
          WHERE city IS NOT NULL AND city != '' AND city != 'Unknown'
          GROUP BY city, country 
          ORDER BY visits DESC 
          LIMIT 10
        `);
        topCities = topCitiesResult.rows || [];
      } catch (error) {
        console.warn('[Analytics] Failed to get top cities:', error);
      }

      try {
        const recentVisitorsResult = await db.execute(`
          SELECT ip_address, country, city, user_agent, visited_at 
          FROM visitors 
          ORDER BY visited_at DESC 
          LIMIT 20
        `);
        recentVisitors = recentVisitorsResult.rows || [];
      } catch (error) {
        console.warn('[Analytics] Failed to get recent visitors:', error);
      }

      clearTimeout(timeoutId);

      // Always return valid data structure
      res.json({
        summary,
        topCountries,
        topCities,
        recentVisitors,
        status: 'success'
      });

    } catch (systemError) {
      console.error('[Analytics] System error:', systemError);
      
      // Ensure response is sent even on critical failure
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Analytics temporarily unavailable',
          summary: { totalVisitors: 0, uniqueIPs: 0 },
          topCountries: [],
          topCities: [],
          recentVisitors: [],
          status: 'error'
        });
      }
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

    // Auto-register user immediately on connection - use uppercase device ID for font clarity
    userId = generateDeviceId();
    
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
