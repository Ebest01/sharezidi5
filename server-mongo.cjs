const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createServer } = require('http');

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`[INIT] ShareZidi starting with MongoDB in ${process.env.NODE_ENV || 'development'} mode`);

// MongoDB setup
let db;
let mongoClient;

async function connectMongoDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/sharezidi';
    console.log('[MONGO] Connecting to MongoDB...');
    
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db('sharezidi');
    
    console.log('[MONGO] ✅ Connected successfully');
    
    // Create indexes for better performance
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    
    return true;
  } catch (error) {
    console.error('[MONGO] ❌ Connection failed:', error.message);
    return false;
  }
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS for development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
}

// Serve static files
const staticPath = path.join(__dirname, 'dist', 'public');
try {
  const fs = require('fs');
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    console.log(`[STATIC] Serving files from: ${staticPath}`);
  }
} catch (error) {
  console.log('[STATIC] No static files found, serving API only');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: db ? 'connected' : 'disconnected'
  });
});

// Database test endpoint
app.get('/api/dbtest', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        database: 'disconnected',
        error: 'Database not connected' 
      });
    }

    const stats = await db.admin().serverStatus();
    const userCount = await db.collection('users').countDocuments();
    
    res.json({ 
      success: true, 
      database: 'connected',
      mongoVersion: stats.version,
      userCount: userCount,
      collections: ['users', 'sessions', 'transfers']
    });
  } catch (error) {
    console.error('[DB] Test failed:', error.message);
    res.status(500).json({ 
      success: false, 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// User registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }

    const { username, email } = req.body;
    
    if (!username || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and email are required' 
      });
    }

    // Generate password in format [A-Z{3}][0-9{6}][a-z{2}]
    const upperLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerLetters = 'abcdefghijklmnopqrstuvwxyz';
    
    const password = 
      upperLetters.charAt(Math.floor(Math.random() * upperLetters.length)) +
      upperLetters.charAt(Math.floor(Math.random() * upperLetters.length)) +
      upperLetters.charAt(Math.floor(Math.random() * upperLetters.length)) +
      Math.floor(Math.random() * 1000000).toString().padStart(6, '0') +
      lowerLetters.charAt(Math.floor(Math.random() * lowerLetters.length)) +
      lowerLetters.charAt(Math.floor(Math.random() * lowerLetters.length));
    
    // Get client IP for geolocation
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress ||
                    '127.0.0.1';

    // Create user document
    const userDoc = {
      username,
      email,
      password,
      ipAddress: clientIP,
      country: 'Unknown',
      city: 'Unknown',
      timezone: 'UTC',
      transferCount: 0,
      isPro: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert user
    const result = await db.collection('users').insertOne(userDoc);
    
    // Return user without password
    const { password: _, ...userResponse } = userDoc;
    userResponse._id = result.insertedId;
    
    console.log(`[REGISTER] New user: ${username} (${email}) from ${clientIP}`);
    
    res.json({ 
      success: true, 
      user: userResponse,
      generatedPassword: password,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('[REGISTER] Error:', error.message);
    
    if (error.code === 11000) { // Duplicate key error
      return res.status(409).json({ 
        success: false, 
        error: 'Username or email already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed: ' + error.message 
    });
  }
});

// Get all users endpoint
app.get('/api/users', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }

    const users = await db.collection('users')
      .find({}, { 
        projection: { 
          password: 0  // Exclude password field
        } 
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    
    res.json({ 
      success: true, 
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error('[USERS] Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Fallback route
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'public', 'index.html');
  try {
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ 
        error: 'Frontend not built', 
        message: 'Run build process to generate frontend files' 
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create HTTP server
const server = createServer(app);

// WebSocket support
const wss = new WebSocketServer({ 
  server: server, 
  path: '/ws' 
});

wss.on('connection', (ws, request) => {
  const clientIP = request.headers['x-forwarded-for'] || 
                  request.headers['x-real-ip'] || 
                  request.socket.remoteAddress;
                  
  console.log(`[WS] Connection from ${clientIP}`);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`[WS] Message: ${message.type}`);
      
      ws.send(JSON.stringify({ 
        type: 'echo', 
        data: message,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('[WS] Message error:', error.message);
    }
  });
  
  ws.on('close', () => {
    console.log(`[WS] Connection closed: ${clientIP}`);
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('[SHUTDOWN] Graceful shutdown initiated');
  server.close(async () => {
    console.log('[SHUTDOWN] HTTP server closed');
    if (mongoClient) {
      await mongoClient.close();
      console.log('[SHUTDOWN] MongoDB connection closed');
    }
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function startServer() {
  const dbConnected = await connectMongoDB();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] ✅ ShareZidi running on port ${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SERVER] Database: ${dbConnected ? '✅' : '❌'} MongoDB ${dbConnected ? 'Connected' : 'Disconnected'}`);
    console.log(`[SERVER] WebSocket: ✅ Ready on /ws`);
    console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[SERVER] Database test: http://localhost:${PORT}/api/dbtest`);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught Exception:', error);
  gracefulShutdown();
});

startServer();