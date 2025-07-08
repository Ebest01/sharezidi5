const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Enhanced logging
const log = (message, source = "express") => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} AM [${source}] ${message}`);
};

log(`Starting ShareZidi production server on port ${PORT}`);

// MongoDB setup with EasyPanel credentials
const username = 'szmdb_user';
const password = '11!!!!...Magics4321';
const host = 'sharezidi_v2_sharezidi_mdb';
const port = '27017';

const encodedPassword = encodeURIComponent(password);
const mongoUrl = `mongodb://${username}:${encodedPassword}@${host}:${port}/?tls=false`;

let db = null;
let client = null;

// Connect to MongoDB
async function connectToMongo() {
  try {
    log("Connecting to MongoDB...");
    client = new MongoClient(mongoUrl, { useUnifiedTopology: true });
    await client.connect();
    db = client.db('sharezidi');
    log("✅ Connected to MongoDB successfully!");
    return true;
  } catch (error) {
    log(`MongoDB connection failed: ${error.message}`);
    return false;
  }
}

// Initialize database connection
connectToMongo();

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  
  if (db) {
    try {
      await db.query('SELECT 1');
      dbStatus = 'connected';
    } catch (error) {
      log(`Health check database error: ${error.message}`);
    }
  }

  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: dbStatus,
    port: PORT
  });
});

// Database test endpoint
app.get('/api/dbtest', async (req, res) => {
  if (!db) {
    return res.json({
      success: false,
      error: 'Database not configured',
      database: 'disconnected',
      userCount: 0,
      collections: []
    });
  }

  try {
    // Test connection
    const testResult = await db.admin().ping();
    
    // Get user count
    let userCount = 0;
    try {
      userCount = await db.collection('users').countDocuments();
    } catch (error) {
      log(`User count query failed: ${error.message}`);
    }

    // Get collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    res.json({ 
      success: true, 
      database: 'connected',
      userCount: userCount,
      collections: collectionNames,
      version: 'MongoDB',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log(`Database test failed: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      database: 'disconnected',
      error: error.message,
      userCount: 0,
      collections: []
    });
  }
});

// User registration endpoint
app.post('/api/register', async (req, res) => {
  const { username, email } = req.body;

  if (!username || !email) {
    return res.status(400).json({
      success: false,
      error: 'Username and email are required'
    });
  }

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not available'
    });
  }

  try {
    // Generate a simple password
    const generatedPassword = `Pass${Math.floor(Math.random() * 10000)}`;
    
    // Check if user exists
    const existingUser = await db.collection('users').findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username or email already exists'
      });
    }
    
    // Insert user
    const userDoc = {
      username,
      email,
      createdAt: new Date(),
      transferCount: 0,
      isPro: false,
      generatedPassword
    };
    
    const result = await db.collection('users').insertOne(userDoc);
    
    res.json({
      success: true,
      user: {
        _id: result.insertedId.toString(),
        username: userDoc.username,
        email: userDoc.email,
        transferCount: userDoc.transferCount,
        isPro: userDoc.isPro,
        createdAt: userDoc.createdAt
      },
      generatedPassword: generatedPassword,
      message: 'User created successfully'
    });

    log(`User created: ${username} (${email})`);
  } catch (error) {
    log(`Registration failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Registration failed: ' + error.message
    });
  }
});

// Get all users endpoint
app.get('/api/users', async (req, res) => {
  if (!db) {
    return res.json({
      success: false,
      error: 'Database not available',
      users: []
    });
  }

  try {
    const users = await db.collection('users')
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const formattedUsers = users.map(user => ({
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      transferCount: user.transferCount || 0,
      isPro: user.isPro || false,
      createdAt: user.createdAt,
      ipAddress: user.ipAddress
    }));

    res.json({
      success: true,
      users: formattedUsers,
      count: formattedUsers.length
    });
  } catch (error) {
    log(`Failed to fetch users: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users: ' + error.message,
      users: []
    });
  }
});

// Serve static files from multiple possible locations
const possiblePaths = [
  path.resolve(process.cwd(), "dist", "public"),
  path.resolve(process.cwd(), "client", "dist"),
  path.resolve(process.cwd(), "dist"),
  path.resolve(process.cwd(), "public")
];

let distPath;
for (const p of possiblePaths) {
  try {
    const fs = require('fs');
    if (fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      log(`Found static files at: ${distPath}`);
      break;
    }
  } catch (e) {
    // Continue to next path
  }
}

if (!distPath) {
  log("No index.html found, using default path");
  distPath = path.resolve(process.cwd(), "dist", "public");
}

app.use(express.static(distPath));

// Catch-all handler for SPA routing
app.get("*", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  log(`Serving SPA route: ${req.path} -> ${indexPath}`);
  res.sendFile(indexPath);
});

// Create HTTP server
const server = createServer(app);

// WebSocket setup (basic implementation)
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, request) => {
  const clientIP = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
  log(`WebSocket connection from ${clientIP}`);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      log(`WebSocket message: ${data.type}`);
      
      // Echo back for basic functionality
      ws.send(JSON.stringify({
        type: 'ack',
        originalType: data.type,
        timestamp: Date.now()
      }));
    } catch (error) {
      log(`WebSocket message error: ${error.message}`);
    }
  });

  ws.on("close", () => {
    log(`WebSocket disconnected from ${clientIP}`);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to ShareZidi WebSocket',
    timestamp: Date.now()
  }));
});

// Error handling
app.use((err, req, res, next) => {
  log(`Server error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  log(`ShareZidi production server running on port ${PORT}`);
  log(`Database: ${db ? 'Connected' : 'Not configured'}`);
  log(`Static files: ${distPath}`);
  log(`WebSocket: Enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    if (db) {
      db.end();
    }
    process.exit(0);
  });
});