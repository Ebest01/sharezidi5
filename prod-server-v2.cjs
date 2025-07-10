const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const crypto = require('crypto');
const { promisify } = require('util');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('[SERVER] Starting ShareZidi Production Server...');
console.log('[SERVER] Environment:', process.env.NODE_ENV);
console.log('[SERVER] Port:', PORT);

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://shzmdb2:11xxshzMDB@193.203.165.217:27017/sharezidi?authSource=admin&ssl=false';

async function connectMongoDB() {
  try {
    console.log('[MONGODB] Connecting to database...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      dbName: 'sharezidi',  // Explicitly force sharezidi database
    });
    console.log('[MONGODB] ✅ Connected successfully');
    console.log('[MONGODB] Database name:', mongoose.connection.db.databaseName);
    console.log('[MONGODB] Expected: sharezidi, Actual:', mongoose.connection.db.databaseName);
    return true;
  } catch (error) {
    console.error('[MONGODB] ❌ Connection failed:', error.message);
    return false;
  }
}

// User Schema with full geolocation support
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

// Visitor Schema for analytics
const visitorSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  ipAddress: { type: String, required: true },
  userAgent: String,
  lastVisitTime: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 1 },
  pageViews: { type: Number, default: 1 },
  sessionDuration: { type: Number, default: 0 }, // in seconds
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

const User = mongoose.model('User', userSchema);
const Visitor = mongoose.model('Visitor', visitorSchema);

// Password utilities
const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
}

// Password generator - Format: [A-Z{3}][0-9{6}][a-z{2}]
function generatePassword() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const lowerLetters = 'abcdefghijklmnopqrstuvwxyz';
  
  let password = '';
  for (let i = 0; i < 3; i++) password += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 6; i++) password += numbers[Math.floor(Math.random() * numbers.length)];
  for (let i = 0; i < 2; i++) password += lowerLetters[Math.floor(Math.random() * lowerLetters.length)];
  
  return password;
}

function extractUsernameFromEmail(email) {
  return email.split('@')[0];
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Geolocation service
async function getLocationData(ip) {
  try {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return null;
    }
    
    const response = await fetch(`http://ip-api.com/json/${ip}`, { timeout: 2000 });
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.status === 'success' ? {
      country: data.country,
      country_code: data.countryCode,
      region: data.regionName,
      city: data.city,
      timezone: data.timezone,
      latitude: data.lat?.toString(),
      longitude: data.lon?.toString(),
      isp: data.isp
    } : null;
  } catch (error) {
    return null;
  }
}

function extractIPAddress(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         '127.0.0.1';
}

// API Routes
app.get('/api/auth/user', async (req, res) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1];
  
  try {
    if (sessionId) {
      const user = await User.findOne({ username: sessionId });
      if (user) {
        return res.json({
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          transferCount: user.transferCount,
          isPro: user.isPro,
          isGuest: false
        });
      }
    }
    
    res.json({
      id: 'guest',
      email: 'guest@sharezidi.com',
      transferCount: 0,
      isPro: false,
      isGuest: true
    });
  } catch (error) {
    console.error('[AUTH] Error:', error);
    res.json({
      id: 'guest',
      email: 'guest@sharezidi.com',
      transferCount: 0,
      isPro: false,
      isGuest: true
    });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate password and hash it
    const generatedPassword = generatePassword();
    const hashedPassword = await hashPassword(generatedPassword);
    const username = extractUsernameFromEmail(email);

    // Get geolocation data
    const ip = extractIPAddress(req);
    const locationData = await getLocationData(ip);

    const newUser = await new User({
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
    }).save();

    console.log('[REGISTER] ✅ User created:', email);

    res.status(201).json({
      success: true,
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username
      },
      generatedPassword: generatedPassword,
      message: 'Registration successful! Save your password.'
    });

  } catch (error) {
    console.error('[REGISTER] Error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await comparePasswords(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last visit time and geolocation on login
    const ip = extractIPAddress(req);
    const locationData = await getLocationData(ip);
    
    await User.updateOne(
      { _id: user._id },
      { 
        lastVisitTime: new Date(),
        ipAddress: ip,
        country: locationData?.country || user.country,
        countryCode: locationData?.country_code || user.countryCode,
        region: locationData?.region || user.region,
        city: locationData?.city || user.city,
        timezone: locationData?.timezone || user.timezone,
        latitude: locationData?.latitude || user.latitude,
        longitude: locationData?.longitude || user.longitude,
        isp: locationData?.isp || user.isp
      }
    );

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
      sessionToken: user.username
    });

  } catch (error) {
    console.error('[LOGIN] Error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Add /api/auth/login endpoint for frontend compatibility
app.post("/api/auth/login", async (req, res) => {
  console.log("[AUTH-LOGIN] ===== LOGIN START =====");
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log("[AUTH-LOGIN] Missing email or password");
      return res.status(400).json({ error: "Email and password are required" });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log("[AUTH-LOGIN] User not found:", email);
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    // Verify password
    const passwordMatch = await comparePasswords(password, user.password || '');
    
    if (!passwordMatch) {
      console.log("[AUTH-LOGIN] Invalid password for:", email);
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    console.log("[AUTH-LOGIN] ✅ Login successful:", email);
    console.log("[AUTH-LOGIN] ===== LOGIN END =====");
    
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
      sessionToken: user.username,
      message: "Login successful"
    });
    
  } catch (error) {
    console.error("[AUTH-LOGIN] Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get('/api/dbtest/users', async (req, res) => {
  try {
    const users = await User.find({})
      .select('email username transferCount isPro createdAt country city')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('[DBTEST] Error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/analytics', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalVisitors = await Visitor.countDocuments();
    
    res.json({
      totalUsers,
      totalVisitors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ANALYTICS] Error:', error);
    res.json({ totalUsers: 0, totalVisitors: 0, timestamp: new Date().toISOString() });
  }
});

app.get('/health', async (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
    port: PORT,
    environment: process.env.NODE_ENV,
    connectedDevices: Object.keys(connectedUsers).length
  });
});

// Track visitors
app.use('/', async (req, res, next) => {
  try {
    if (!req.path.startsWith('/api/') && !req.path.includes('.')) {
      const ip = extractIPAddress(req);
      const locationData = await getLocationData(ip);
      const sessionId = req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1] || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Check if visitor already exists for this session
      const existingVisitor = await Visitor.findOne({ sessionId });
      
      if (existingVisitor) {
        // Update existing visitor with new visit time and increment counters
        await Visitor.updateOne(
          { sessionId },
          { 
            lastVisitTime: new Date(),
            $inc: { visitCount: 1, pageViews: 1 },
            ipAddress: ip,
            userAgent: req.headers['user-agent'] || '',
            country: locationData?.country || existingVisitor.country,
            countryCode: locationData?.country_code || existingVisitor.countryCode,
            region: locationData?.region || existingVisitor.region,
            city: locationData?.city || existingVisitor.city,
            timezone: locationData?.timezone || existingVisitor.timezone,
            latitude: locationData?.latitude || existingVisitor.latitude,
            longitude: locationData?.longitude || existingVisitor.longitude,
            isp: locationData?.isp || existingVisitor.isp,
            referrer: req.headers.referer || ''
          }
        );
      } else {
        // Create new visitor record
        const visitorData = {
          sessionId,
          ipAddress: ip,
          userAgent: req.headers['user-agent'] || '',
          lastVisitTime: new Date(),
          visitCount: 1,
          pageViews: 1,
          sessionDuration: 0,
          referrer: req.headers.referer || '',
          country: locationData?.country || 'Unknown',
          countryCode: locationData?.country_code || '',
          region: locationData?.region || '',
          city: locationData?.city || '',
          timezone: locationData?.timezone || '',
          latitude: locationData?.latitude || '',
          longitude: locationData?.longitude || '',
          isp: locationData?.isp || '',
          visitedAt: new Date()
        };

        try {
          await new Visitor(visitorData).save();
        } catch (err) {
          // Silent fail for visitor tracking
        }
      }
    }
  } catch (error) {
    // Silent fail for visitor tracking
  }
  next();
});

// Serve static files
const publicPath = path.join(__dirname, 'dist', 'public');
console.log('[SERVER] Static files path:', publicPath);

// Serve assets
app.use('/assets', express.static(path.join(publicPath, 'assets')));

// Catch-all for SPA
app.get('*', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'Frontend not found',
      path: indexPath,
      exists: false
    });
  }
});

// Create HTTP server for WebSocket
const server = http.createServer(app);

// =====================================================
// FILE TRANSFER WEBSOCKET SYSTEM - PRESERVE ALL FUNCTIONALITY
// =====================================================

// Connected users storage
const connectedUsers = {};

// WebSocket server on /ws path
const wss = new WebSocketServer({ 
  server, 
  path: '/ws',
  perMessageDeflate: false
});

console.log('[WebSocket] File transfer server ready on /ws');

wss.on('connection', (ws, request) => {
  console.log('[WebSocket] New connection from:', request.socket.remoteAddress);
  
  let userId = null;
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
  
  // Register user
  connectedUsers[userId] = {
    id: userId,
    name: deviceName,
    ws: ws,
    lastSeen: new Date(),
    isActive: true
  };

  console.log(`[FileTransfer] User ${userId} (${deviceName}) connected`);
  
  // Send registration confirmation
  ws.send(JSON.stringify({
    type: 'registration-confirmed',
    userId: userId,
    deviceName: deviceName
  }));

  // Broadcast updated device list to all users
  broadcastDeviceList();

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(userId, message);
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    if (userId && connectedUsers[userId]) {
      delete connectedUsers[userId];
      console.log(`[FileTransfer] User ${userId} disconnected`);
      broadcastDeviceList();
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Connection error:', error);
  });
});

// Message handler - preserves all file transfer functionality
function handleMessage(userId, message) {
  const user = connectedUsers[userId];
  if (!user) return;

  user.lastSeen = new Date();

  switch (message.type) {
    case 'register':
      // Already handled in connection
      break;

    case 'transfer-request':
      console.log(`[FileTransfer] Transfer request from ${userId} to ${message.toUserId}`);
      console.log(`[FileTransfer] File: ${message.fileInfo.name} (${message.fileInfo.size} bytes)`);
      
      forwardMessage(message.toUserId, {
        type: 'transfer-request',
        from: userId,
        toUserId: message.toUserId,
        fileInfo: message.fileInfo,
        fileId: message.fileId
      });
      break;

    case 'transfer-response':
      console.log(`[FileTransfer] Transfer response from ${userId}: ${message.accepted}`);
      forwardMessage(message.fromUserId, {
        type: 'transfer-response',
        from: userId,
        accepted: message.accepted,
        fileId: message.fileId,
        reason: message.reason
      });
      break;

    case 'file-chunk':
      // Forward chunk data with progress tracking
      forwardMessage(message.receiverId, {
        type: 'file-chunk',
        from: userId,
        chunkIndex: message.chunkIndex,
        chunk: message.chunk,
        fileId: message.fileId,
        totalChunks: message.totalChunks
      });
      break;

    case 'chunk-ack':
      // Forward chunk acknowledgment
      forwardMessage(message.toUserId, {
        type: 'chunk-ack',
        from: userId,
        chunkIndex: message.chunkIndex,
        fileId: message.fileId,
        status: message.status,
        receiverProgress: message.receiverProgress
      });
      break;

    case 'sync-status':
      // Forward synchronization status
      forwardMessage(message.receiverId, {
        type: 'sync-status',
        from: userId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        fileId: message.fileId,
        senderProgress: message.senderProgress,
        receiverProgress: message.receiverProgress,
        syncLag: message.syncLag,
        duplicatesRejected: message.duplicatesRejected,
        lastChunkTime: message.lastChunkTime
      });
      break;

    case 'transfer-complete':
      console.log(`[FileTransfer] Transfer complete from ${userId} for file ${message.fileId}`);
      forwardMessage(message.toUserId, {
        type: 'transfer-complete',
        from: userId,
        fileId: message.fileId
      });
      break;

    case 'ping':
      // Respond to ping to keep connection alive
      user.ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      console.log(`[WebSocket] Unknown message type: ${message.type}`);
  }
}

// Forward message to specific user
function forwardMessage(targetUserId, message) {
  const targetUser = connectedUsers[targetUserId];
  if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
    targetUser.ws.send(JSON.stringify(message));
  } else {
    console.warn(`[WebSocket] Target user ${targetUserId} not found or not connected`);
  }
}

// Broadcast device list to all connected users
function broadcastDeviceList() {
  const devices = Object.values(connectedUsers).map(user => ({
    id: user.id,
    name: user.name,
    online: true,
    lastSeen: user.lastSeen
  }));

  const message = JSON.stringify({ type: 'devices', devices });
  
  Object.values(connectedUsers).forEach(user => {
    if (user.ws.readyState === WebSocket.OPEN) {
      try {
        user.ws.send(message);
      } catch (error) {
        console.error('[WebSocket] Error sending device list:', error);
      }
    }
  });
}

// Cleanup inactive connections
setInterval(() => {
  const now = new Date();
  const timeout = 5 * 60 * 1000; // 5 minutes

  Object.keys(connectedUsers).forEach(userId => {
    const user = connectedUsers[userId];
    if (user.ws.readyState !== WebSocket.OPEN || 
        (now.getTime() - user.lastSeen.getTime()) > timeout) {
      delete connectedUsers[userId];
      console.log(`[FileTransfer] Cleaned up inactive user: ${userId}`);
    }
  });
}, 60000); // Check every minute

// Start server
async function startServer() {
  const dbConnected = await connectMongoDB();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ [SERVER] ShareZidi running on port ${PORT}`);
    console.log(`📊 [DATABASE] ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`🔄 [WEBSOCKET] ✅ File transfer ready on /ws`);
    console.log(`🌐 [HEALTH] http://localhost:${PORT}/health`);
    console.log(`🔗 [APP] Ready to serve requests`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] Received SIGTERM, shutting down gracefully');
  server.close(() => {
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close();
    }
    process.exit(0);
  });
});

startServer().catch(console.error);