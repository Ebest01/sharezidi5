const express = require('express');
const { createServer } = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'sharezidi-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static files (built frontend)
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const mongoUrl = process.env.MONGODB_URI || 'mongodb://shzmdb2:11xxshzMDB@193.203.165.217:27017/sharezidi?authSource=admin&ssl=false';
mongoose.connect(mongoUrl)
  .then(() => {
    console.log('[MONGODB] ✅ Connected successfully');
  })
  .catch(err => {
    console.error('[MONGODB] ❌ Connection failed:', err.message);
    console.log('[MONGODB] ⚠️ Continuing without database...');
  });

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  createdAt: { type: Date, default: Date.now },
  lastVisitTime: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 1 },
  pageViews: { type: Number, default: 1 },
  sessionDuration: { type: Number, default: 0 },
  isPro: { type: Boolean, default: false },
  transfersUsed: { type: Number, default: 0 },
  transferLimit: { type: Number, default: 15 },
  
  // Geolocation fields
  ipAddress: String,
  country: String,
  countryCode: String,
  region: String,
  regionName: String,
  city: String,
  zip: String,
  lat: Number,
  lon: Number,
  timezone: String,
  isp: String,
  org: String,
  as: String,
  query: String,
  continent: String,
  continentCode: String,
  district: String,
  mobile: Boolean,
  proxy: Boolean,
  hosting: Boolean
});

const User = mongoose.model('User', userSchema);

// Visitor Schema
const visitorSchema = new mongoose.Schema({
  ipAddress: { type: String, unique: true, required: true },
  visitCount: { type: Number, default: 1 },
  firstVisit: { type: Date, default: Date.now },
  lastVisit: { type: Date, default: Date.now },
  pageViews: { type: Number, default: 1 },
  sessionDuration: { type: Number, default: 0 },
  
  // Geolocation fields
  country: String,
  countryCode: String,
  region: String,
  regionName: String,
  city: String,
  zip: String,
  lat: Number,
  lon: Number,
  timezone: String,
  isp: String,
  org: String,
  as: String,
  query: String,
  continent: String,
  continentCode: String,
  district: String,
  mobile: Boolean,
  proxy: Boolean,
  hosting: Boolean
});

const Visitor = mongoose.model('Visitor', visitorSchema);

// Password verification with multiple fallbacks
async function verifyPassword(inputPassword, storedPassword) {
  try {
    // Try BCrypt first (preferred for new users)
    if (storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$')) {
      return await bcrypt.compare(inputPassword, storedPassword);
    }
    
    // Fallback for legacy scrypt format
    if (storedPassword.includes('.')) {
      const crypto = require('crypto');
      const util = require('util');
      const scryptAsync = util.promisify(crypto.scrypt);
      
      const [hashed, salt] = storedPassword.split('.');
      const hashedBuf = Buffer.from(hashed, 'hex');
      const suppliedBuf = await scryptAsync(inputPassword, salt, 64);
      return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
    }
    
    // Direct comparison fallback
    return inputPassword === storedPassword;
  } catch (error) {
    console.error('[AUTH] Password verification error:', error);
    return false;
  }
}

// Authentication routes
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('[AUTH] Login attempt for:', email);
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log('[AUTH] User not found:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      console.log('[AUTH] Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Update last visit time
    user.lastVisitTime = new Date();
    user.visitCount = (user.visitCount || 0) + 1;
    await user.save();
    
    req.session.userId = user._id;
    console.log('[AUTH] ✅ Login successful for:', email);
    
    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isPro: user.isPro,
      transfersUsed: user.transfersUsed,
      transferLimit: user.transferLimit
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[AUTH] Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    console.log('[AUTH] ✅ Logout successful');
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/auth/user', async (req, res) => {
  try {
    console.log('[AUTH] Frontend requesting user authentication status');
    
    if (!req.session.userId) {
      console.log('[AUTH] No user session found');
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const user = await User.findById(req.session.userId);
    if (!user) {
      console.log('[AUTH] User not found in database');
      return res.status(401).json({ error: 'User not found' });
    }
    
    console.log('[AUTH] ✅ User authenticated:', user.email);
    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isPro: user.isPro,
      transfersUsed: user.transfersUsed,
      transferLimit: user.transferLimit
    });
  } catch (error) {
    console.error('[AUTH] User check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket setup
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// Connected devices storage
const connectedDevices = new Map();
const activeTransfers = new Map();

wss.on('connection', (ws, req) => {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`[WebSocket] New connection from ${clientIP}`);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WebSocket] Received message:`, message.type);
      
      switch (message.type) {
        case 'register':
          const deviceId = message.deviceId;
          const deviceName = message.deviceName || 'Unknown Device';
          
          connectedDevices.set(deviceId, {
            ws,
            deviceName,
            lastSeen: Date.now()
          });
          
          ws.deviceId = deviceId;
          ws.send(JSON.stringify({ type: 'registered', deviceId }));
          
          // Broadcast updated device list
          const devices = Array.from(connectedDevices.entries()).map(([id, info]) => ({
            id,
            name: info.deviceName,
            lastSeen: info.lastSeen
          }));
          
          connectedDevices.forEach((device) => {
            if (device.ws.readyState === WebSocket.OPEN) {
              device.ws.send(JSON.stringify({
                type: 'devices',
                data: devices
              }));
            }
          });
          break;
          
        case 'transfer-request':
          const targetDevice = connectedDevices.get(message.targetDeviceId);
          if (targetDevice && targetDevice.ws.readyState === WebSocket.OPEN) {
            targetDevice.ws.send(JSON.stringify({
              type: 'transfer-request',
              senderId: message.senderId,
              senderName: message.senderName,
              fileInfo: message.fileInfo
            }));
          }
          break;
          
        case 'transfer-response':
          const senderDevice = connectedDevices.get(message.senderId);
          if (senderDevice && senderDevice.ws.readyState === WebSocket.OPEN) {
            senderDevice.ws.send(JSON.stringify({
              type: 'transfer-response',
              accepted: message.accepted,
              receiverId: message.receiverId
            }));
          }
          break;
          
        case 'file-chunk':
          const receiverDevice = connectedDevices.get(message.receiverId);
          if (receiverDevice && receiverDevice.ws.readyState === WebSocket.OPEN) {
            receiverDevice.ws.send(JSON.stringify(message));
          }
          break;
          
        case 'chunk-ack':
          const senderForAck = connectedDevices.get(message.senderId);
          if (senderForAck && senderForAck.ws.readyState === WebSocket.OPEN) {
            senderForAck.ws.send(JSON.stringify(message));
          }
          break;
          
        case 'sync-status':
          const targetForSync = message.senderId === ws.deviceId ? 
            connectedDevices.get(message.receiverId) : 
            connectedDevices.get(message.senderId);
          
          if (targetForSync && targetForSync.ws.readyState === WebSocket.OPEN) {
            targetForSync.ws.send(JSON.stringify(message));
          }
          break;
          
        case 'transfer-complete':
          const receiverForComplete = connectedDevices.get(message.receiverId);
          if (receiverForComplete && receiverForComplete.ws.readyState === WebSocket.OPEN) {
            receiverForComplete.ws.send(JSON.stringify(message));
          }
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Message handling error:', error);
    }
  });
  
  ws.on('close', () => {
    if (ws.deviceId) {
      console.log(`[WebSocket] Device disconnected: ${ws.deviceId}`);
      connectedDevices.delete(ws.deviceId);
      
      // Broadcast updated device list
      const devices = Array.from(connectedDevices.entries()).map(([id, info]) => ({
        id,
        name: info.deviceName,
        lastSeen: info.lastSeen
      }));
      
      connectedDevices.forEach((device) => {
        if (device.ws.readyState === WebSocket.OPEN) {
          device.ws.send(JSON.stringify({
            type: 'devices',
            data: devices
          }));
        }
      });
    }
  });
  
  ws.on('error', (error) => {
    console.error('[WebSocket] Connection error:', error);
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] ShareZidi production server running on port ${PORT}`);
  console.log(`[SERVER] WebSocket server running on /ws`);
  console.log(`[SERVER] Frontend served from: ${path.join(__dirname, 'public')}`);
});