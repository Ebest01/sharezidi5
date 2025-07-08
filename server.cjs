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

// Simple database test page
app.get('/simpledbtest', (req, res) => {
  log(`Database test page requested`);
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShareZidi - Database Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .status { padding: 15px; margin: 20px 0; border-radius: 5px; text-align: center; font-weight: bold; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .buttons { display: flex; gap: 15px; justify-content: center; margin: 30px 0; }
        button { padding: 12px 24px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; background: #007bff; color: white; }
        button:hover { background: #0056b3; }
        .output { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 20px; margin: 20px 0; min-height: 100px; font-family: monospace; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 ShareZidi Database Test Interface</h1>
        
        <div class="status success">
            ✅ Production Server Active
        </div>
        
        <div class="status info">
            Server running on port ${PORT} in production mode
        </div>
        
        <div class="buttons">
            <button onclick="testCreate()">CREATE</button>
            <button onclick="testAdd()">ADD</button>
            <button onclick="testShow()">SHOW</button>
        </div>
        
        <div class="output" id="output">Ready for database testing...</div>
        
        <div class="status warning">
            Database operations ready for testing. Click buttons above to test functionality.
        </div>
    </div>

    <script>
        async function testCreate() {
            document.getElementById('output').textContent = 'Testing CREATE operation...';
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                document.getElementById('output').textContent = 
                    'CREATE TEST RESULT:\\n' + JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
        
        async function testAdd() {
            document.getElementById('output').textContent = 'Testing ADD operation...';
            try {
                const response = await fetch('/api/dbtest');
                const data = await response.json();
                document.getElementById('output').textContent = 
                    'ADD TEST RESULT:\\n' + JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
        
        async function testShow() {
            document.getElementById('output').textContent = 'Testing SHOW operation...';
            try {
                const response = await fetch('/api/users');
                const data = await response.json();
                document.getElementById('output').textContent = 
                    'SHOW TEST RESULT:\\n' + JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
  `);
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