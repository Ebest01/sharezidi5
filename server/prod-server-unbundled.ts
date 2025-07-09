import express from 'express';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB connection (lazy loaded to avoid bundling issues)
let mongoose: any;
let User: any;
let Visitor: any;

async function initMongoDB() {
  try {
    if (!mongoose) {
      mongoose = await import('mongoose');
      
      // User Schema
      const userSchema = new mongoose.Schema({
        email: { type: String, required: true, unique: true },
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        transferCount: { type: Number, default: 0 },
        isPro: { type: Boolean, default: false },
        subscriptionDate: { type: Date, default: Date.now },
        lastResetDate: { type: Date, default: Date.now },
        ipAddress: String,
        country: String,
        countryCode: String,
        region: String,
        city: String,
        timezone: String,
        latitude: String,
        longitude: String,
        isp: String,
      }, { timestamps: true });

      // Visitor Schema
      const visitorSchema = new mongoose.Schema({
        sessionId: { type: String, required: true },
        ipAddress: { type: String, required: true },
        userAgent: String,
        country: String,
        countryCode: String,
        region: String,
        city: String,
        timezone: String,
        latitude: String,
        longitude: String,
        isp: String,
        referrer: String,
        visitedAt: { type: Date, default: Date.now },
      });

      User = mongoose.model('User', userSchema);
      Visitor = mongoose.model('Visitor', visitorSchema);

      const mongoUri = process.env.MONGODB_URI || 'mongodb://shzmdb2:11xxshzMDB@193.203.165.217:27017/sharezidi?authSource=admin&ssl=false';
      console.log('[MONGODB] Connecting to:', mongoUri.replace(/:[^:]*@/, ':***@'));
      
      await mongoose.connect(mongoUri);
      console.log('[MONGODB] ✅ Connected successfully');
    }
  } catch (error) {
    console.warn('[MONGODB] ⚠️ Connection failed:', error.message);
    console.log('[STARTUP] Continuing without database...');
  }
}

// Initialize MongoDB
initMongoDB().catch(() => {
  console.log('[STARTUP] ✅ Server starting without database connection');
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../client');
  app.use(express.static(clientDistPath));
  
  // Catch-all handler for SPA routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Simple user storage fallback
const memoryUsers = new Map();
const memoryVisitors = new Map();

// API Routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, username, password, ...geoData } = req.body;
    
    const userData = {
      email,
      username,
      password,
      transferCount: 0,
      isPro: false,
      subscriptionDate: new Date(),
      lastResetDate: new Date(),
      ...geoData,
    };

    if (User) {
      const user = new User(userData);
      await user.save();
      console.log('[USER] ✅ Registered:', username);
      res.json({ success: true, user: { ...userData, password: undefined } });
    } else {
      memoryUsers.set(username, userData);
      console.log('[USER] ✅ Registered (memory):', username);
      res.json({ success: true, user: { ...userData, password: undefined } });
    }
  } catch (error) {
    console.error('[USER] Registration error:', error.message);
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    
    let user;
    if (User) {
      user = await User.findOne({
        $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
      });
    } else {
      user = memoryUsers.get(emailOrUsername) || 
             Array.from(memoryUsers.values()).find(u => u.email === emailOrUsername);
    }

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[USER] ✅ Login:', user.username);
    res.json({ success: true, user: { ...user, password: undefined } });
  } catch (error) {
    console.error('[USER] Login error:', error.message);
    res.status(401).json({ error: 'Login failed' });
  }
});

app.get('/api/analytics', async (req, res) => {
  try {
    let totalUsers = 0;
    let totalVisitors = 0;

    if (User && Visitor) {
      totalUsers = await User.countDocuments();
      totalVisitors = await Visitor.countDocuments();
    } else {
      totalUsers = memoryUsers.size;
      totalVisitors = memoryVisitors.size;
    }

    res.json({
      totalUsers,
      totalVisitors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ANALYTICS] Error:', error.message);
    res.json({ totalUsers: 0, totalVisitors: 0, timestamp: new Date().toISOString() });
  }
});

// Track visitors
app.use('/', async (req, res, next) => {
  try {
    if (!req.path.startsWith('/api/') && !req.path.includes('.')) {
      const visitorData = {
        sessionId: req.sessionID || 'unknown',
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || '',
        referrer: req.get('Referrer') || '',
        visitedAt: new Date(),
      };

      if (Visitor) {
        const visitor = new Visitor(visitorData);
        await visitor.save();
      } else {
        memoryVisitors.set(Date.now(), visitorData);
      }
    }
  } catch (error) {
    console.error('[VISITOR] Tracking error:', error.message);
  }
  next();
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[SERVER] ShareZidi production server running on port ${port}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV}`);
  console.log(`[SERVER] MongoDB: ${mongoose ? 'Connected' : 'Memory fallback'}`);
});

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

interface ConnectedUser {
  id: string;
  name: string;
  ws: WebSocket;
  lastSeen: Date;
}

const connectedUsers = new Map<string, ConnectedUser>();

wss.on('connection', (ws: WebSocket, request) => {
  const ip = request.socket.remoteAddress;
  console.log(`[WebSocket] New connection from ${ip}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'register':
          const userId = message.userId || `user_${Date.now()}`;
          connectedUsers.set(userId, {
            id: userId,
            name: message.deviceName || 'Unknown Device',
            ws,
            lastSeen: new Date()
          });
          console.log(`[FileTransfer] User ${userId} (${message.deviceName}) connected`);
          broadcastDeviceList();
          break;

        case 'file-chunk':
          forwardMessage(message.receiverId, message);
          break;

        case 'transfer-request':
          forwardMessage(message.toUserId, message);
          break;

        case 'transfer-response':
          forwardMessage(message.fromUserId, message);
          break;

        case 'sync-status':
          forwardMessage(message.receiverId, message);
          break;

        default:
          console.log(`[WebSocket] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[WebSocket] Message parsing error:', error.message);
    }
  });

  ws.on('close', () => {
    for (const [userId, user] of connectedUsers.entries()) {
      if (user.ws === ws) {
        connectedUsers.delete(userId);
        console.log(`[FileTransfer] User ${userId} disconnected`);
        broadcastDeviceList();
        break;
      }
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Connection error:', error.message);
  });
});

function forwardMessage(targetUserId: string, message: any) {
  const targetUser = connectedUsers.get(targetUserId);
  if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
    targetUser.ws.send(JSON.stringify(message));
  } else {
    console.warn(`[WebSocket] Target user ${targetUserId} not found or not connected`);
  }
}

function broadcastDeviceList() {
  const devices = Array.from(connectedUsers.values()).map(user => ({
    id: user.id,
    name: user.name,
    online: true,
    lastSeen: user.lastSeen
  }));

  const message = JSON.stringify({ type: 'devices', devices });
  
  connectedUsers.forEach(user => {
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(message);
    }
  });
}

// Cleanup disconnected users
setInterval(() => {
  const now = new Date();
  for (const [userId, user] of connectedUsers.entries()) {
    if (user.ws.readyState !== WebSocket.OPEN || (now.getTime() - user.lastSeen.getTime()) > 300000) {
      connectedUsers.delete(userId);
    }
  }
}, 60000);

process.on('SIGTERM', () => {
  console.log('[SERVER] Received SIGTERM, shutting down gracefully');
  server.close(() => {
    if (mongoose) {
      mongoose.connection.close();
    }
    process.exit(0);
  });
});