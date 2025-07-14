import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import session from "express-session";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB schemas
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

const User = mongoose.models.User || mongoose.model('User', userSchema);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration
app.use(session({
  secret: 'sharezidi-prod-secret-key-2025',
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
  .then(() => console.log('[MONGODB] ✅ Connected successfully'))
  .catch(err => console.error('[MONGODB] ❌ Connection failed:', err));

// Password verification with BCrypt
async function verifyPassword(inputPassword, storedPassword) {
  try {
    // Try BCrypt first (for new users)
    if (storedPassword.startsWith('$2b$')) {
      return await bcrypt.compare(inputPassword, storedPassword);
    }
    
    // Legacy scrypt format fallback
    if (storedPassword.includes('.')) {
      const crypto = await import('crypto');
      const scryptAsync = crypto.promisify(crypto.scrypt);
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
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last visit time
    user.lastVisitTime = new Date();
    await user.save();

    // Create session
    req.session.userId = user._id.toString();
    req.session.userEmail = user.email;
    
    res.json({
      id: user._id,
      email: user.email,
      username: user.username,
      transferCount: user.transferCount,
      isPro: user.isPro
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/user', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      username: user.username,
      transferCount: user.transferCount,
      isPro: user.isPro
    });
  } catch (error) {
    console.error('[AUTH] User fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[AUTH] Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// WebSocket server for file transfers
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const connectedUsers = new Map();

wss.on('connection', (ws, req) => {
  console.log('[WebSocket] New connection from:', req.socket.remoteAddress);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'register') {
        const { userId, deviceName, deviceType } = message;
        connectedUsers.set(userId, { ws, deviceName, deviceType });
        
        ws.send(JSON.stringify({ type: 'registered', userId }));
        
        // Broadcast updated device list
        const deviceList = Array.from(connectedUsers.entries()).map(([id, data]) => 
          `${data.deviceType || 'PC'}-${id} (${id})`
        );
        
        connectedUsers.forEach((userData) => {
          if (userData.ws.readyState === WebSocket.OPEN) {
            userData.ws.send(JSON.stringify({ type: 'devices', data: deviceList }));
          }
        });
      }
      
      // Handle file transfer messages
      if (message.type === 'transfer-request' && message.targetUserId) {
        const targetUser = connectedUsers.get(message.targetUserId);
        if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
          targetUser.ws.send(JSON.stringify(message));
        }
      }
      
    } catch (error) {
      console.error('[WebSocket] Message error:', error);
    }
  });
  
  ws.on('close', () => {
    // Remove disconnected user
    for (const [userId, userData] of connectedUsers.entries()) {
      if (userData.ws === ws) {
        connectedUsers.delete(userId);
        break;
      }
    }
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ShareZidi production server running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Authentication: userh5nu9u@gmail.com / BCB319384xh`);
});