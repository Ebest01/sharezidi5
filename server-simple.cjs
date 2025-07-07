const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`[INIT] ShareZidi MongoDB Server v2 starting...`);

let db;
let mongoClient;

async function connectMongoDB() {
  try {
    // Use the exact connection string from Easypanel without modifications
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sharezidi';
    console.log('[MONGO] Connecting to MongoDB...');
    
    // Try different connection configurations
    const connectionOptions = [
      { authSource: 'admin' },
      { authSource: 'sharezidi' },
      {},
      { authMechanism: 'SCRAM-SHA-1', authSource: 'admin' },
      { authMechanism: 'SCRAM-SHA-256', authSource: 'admin' }
    ];
    
    for (let i = 0; i < connectionOptions.length; i++) {
      try {
        console.log(`[MONGO] Attempt ${i + 1} with options:`, JSON.stringify(connectionOptions[i]));
        mongoClient = new MongoClient(mongoUri, connectionOptions[i]);
        await mongoClient.connect();
        db = mongoClient.db('sharezidi');
        
        // Test the connection
        await db.admin().ping();
        console.log('[MONGO] ✅ Connected successfully');
        
        // Create indexes
        try {
          await db.collection('users').createIndex({ email: 1 }, { unique: true });
          await db.collection('users').createIndex({ username: 1 }, { unique: true });
          console.log('[MONGO] ✅ Indexes created');
        } catch (indexError) {
          console.log('[MONGO] Indexes already exist or optional');
        }
        
        return true;
      } catch (attemptError) {
        console.log(`[MONGO] Attempt ${i + 1} failed:`, attemptError.message);
        if (mongoClient) {
          try { await mongoClient.close(); } catch (e) {}
          mongoClient = null;
        }
      }
    }
    
    console.error('[MONGO] ❌ All connection attempts failed');
    return false;
  } catch (error) {
    console.error('[MONGO] ❌ Connection error:', error.message);
    return false;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    database: db ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    version: '2.0-mongodb'
  });
});

// Database test
app.get('/api/dbtest', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected',
        connectionTried: true
      });
    }

    const userCount = await db.collection('users').countDocuments();
    const collections = await db.listCollections().toArray();
    
    res.json({ 
      success: true, 
      database: 'connected',
      userCount: userCount,
      collections: collections.map(c => c.name),
      version: '2.0-mongodb'
    });
  } catch (error) {
    console.error('[DB] Test error:', error);
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
      createdAt: new Date(),
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1'
    };

    const result = await db.collection('users').insertOne(userDoc);
    
    const { password: _, ...userResponse } = userDoc;
    userResponse._id = result.insertedId;
    
    console.log(`[REGISTER] User created: ${username} (${email})`);
    
    res.json({ 
      success: true, 
      user: userResponse,
      generatedPassword: password,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('[REGISTER] Error:', error);
    
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
    console.error('[USERS] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Default route
app.get('*', (req, res) => {
  res.json({ 
    message: 'ShareZidi MongoDB API v2.0',
    status: db ? 'database-connected' : 'database-disconnected',
    endpoints: [
      'GET /api/health',
      'GET /api/dbtest', 
      'POST /api/register',
      'GET /api/users'
    ]
  });
});

async function startServer() {
  console.log('[INIT] Environment check:');
  console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
  console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('- PORT:', PORT);
  
  const dbConnected = await connectMongoDB();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] ✅ ShareZidi running on port ${PORT}`);
    console.log(`[SERVER] Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[SERVER] Test page: http://localhost:${PORT}/api/dbtest`);
    console.log(`[SERVER] Ready for deployment testing!`);
  });
}

process.on('SIGTERM', async () => {
  console.log('[SHUTDOWN] Graceful shutdown...');
  if (mongoClient) {
    await mongoClient.close();
    console.log('[SHUTDOWN] MongoDB connection closed');
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Promise Rejection:', reason);
});

startServer();