const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`[INIT] ShareZidi MongoDB Server starting...`);

// MongoDB setup
let db;
let mongoClient;

async function connectMongoDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sharezidi';
    console.log('[MONGO] Connecting to:', mongoUri.replace(/\/\/.*@/, '//*****@'));
    
    mongoClient = new MongoClient(mongoUri, {
      authSource: 'admin',
      directConnection: true
    });
    await mongoClient.connect();
    db = mongoClient.db('sharezidi');
    
    console.log('[MONGO] ✅ Connected');
    
    // Create indexes
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ username: 1 }, { unique: true });
    } catch (indexError) {
      console.log('[MONGO] Indexes already exist');
    }
    
    return true;
  } catch (error) {
    console.error('[MONGO] ❌ Failed:', error.message);
    return false;
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    database: db ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Database test
app.get('/api/dbtest', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }

    const userCount = await db.collection('users').countDocuments();
    
    res.json({ 
      success: true, 
      database: 'connected',
      userCount: userCount,
      collections: ['users', 'sessions']
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// User registration
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
        error: 'Username and email required' 
      });
    }

    // Generate password [A-Z{3}][0-9{6}][a-z{2}]
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    
    const password = 
      upper.charAt(Math.floor(Math.random() * upper.length)) +
      upper.charAt(Math.floor(Math.random() * upper.length)) +
      upper.charAt(Math.floor(Math.random() * upper.length)) +
      Math.floor(Math.random() * 1000000).toString().padStart(6, '0') +
      lower.charAt(Math.floor(Math.random() * lower.length)) +
      lower.charAt(Math.floor(Math.random() * lower.length));
    
    const userDoc = {
      username,
      email,
      password,
      transferCount: 0,
      isPro: false,
      createdAt: new Date()
    };

    const result = await db.collection('users').insertOne(userDoc);
    
    const { password: _, ...userResponse } = userDoc;
    userResponse._id = result.insertedId;
    
    res.json({ 
      success: true, 
      user: userResponse,
      generatedPassword: password
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        error: 'Username or email already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get users
app.get('/api/users', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }

    const users = await db.collection('users')
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    
    res.json({ 
      success: true, 
      users: users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Default route
app.get('*', (req, res) => {
  res.json({ 
    message: 'ShareZidi MongoDB API',
    endpoints: [
      'GET /api/health',
      'GET /api/dbtest', 
      'POST /api/register',
      'GET /api/users'
    ]
  });
});

// Start server
async function startServer() {
  const dbConnected = await connectMongoDB();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] ✅ Running on port ${PORT}`);
    console.log(`[SERVER] Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`[SERVER] Health: http://localhost:${PORT}/api/health`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (mongoClient) await mongoClient.close();
  process.exit(0);
});

startServer();