const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`[INIT] ShareZidi MongoDB Server - FIXED CREDENTIALS`);

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// CORRECT MongoDB connection using EXACT EasyPanel credentials
const username = 'szmdb_user';
const password = '11!!!!...Magics4321';
const host = 'sharezidi_v2_sharezidi_mdb';
const port = '27017';

// URL encode the password to handle special characters
const encodedPassword = encodeURIComponent(password);
const mongoUrl = `mongodb://${username}:${encodedPassword}@${host}:${port}/?tls=false`;

console.log('[MONGO] Using CORRECT credentials:');
console.log('- User:', username);
console.log('- Host:', host);
console.log('- Port:', port);
console.log('- Password: 11!!!!...Magics4321');

let db;
let client;

// Connect to MongoDB
async function connectToMongo() {
  try {
    console.log('[MONGO] Connecting to MongoDB with FIXED credentials...');
    
    client = new MongoClient(mongoUrl, {
      useUnifiedTopology: true
    });
    
    await client.connect();
    
    // Use 'sharezidi' as database name
    db = client.db('sharezidi');
    
    console.log('✅ [MONGO] Connected successfully with FIXED credentials!');
    console.log('✅ [MONGO] Using database: sharezidi');
    
    // Test the connection by listing collections
    const collections = await db.listCollections().toArray();
    console.log(`[MONGO] Collections found: ${collections.length}`);
    
    // Create indexes for users collection
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ username: 1 }, { unique: true });
      console.log('[MONGO] Indexes created successfully');
    } catch (indexError) {
      console.log('[MONGO] Indexes already exist or optional');
    }
    
    return true;
    
  } catch (err) {
    console.error('❌ [MONGO] Connection STILL failed:', err.message);
    console.error('❌ [MONGO] URL used:', mongoUrl.replace(encodedPassword, '[HIDDEN]'));
    return false;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  if (db) {
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date(),
      version: 'FIXED-CREDENTIALS'
    });
  } else {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      timestamp: new Date(),
      version: 'FIXED-CREDENTIALS'
    });
  }
});

// Database test endpoint
app.get('/api/dbtest', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected',
        credentials: 'szmdb_user with 11!!!!...Magics4321'
      });
    }

    const users = db.collection('users');
    const userCount = await users.countDocuments();
    const collections = await db.listCollections().toArray();
    
    res.json({ 
      success: true, 
      database: 'connected',
      userCount: userCount,
      collections: collections.map(c => c.name),
      credentials: 'FIXED: szmdb_user@sharezidi_v2_sharezidi_mdb',
      version: 'Working'
    });
    
  } catch (err) {
    console.error('[DBTEST] Error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// User registration endpoint - Using auto-password format
app.post("/api/register", async (req, res) => {
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

    const users = db.collection('users');
    
    // Check if user exists
    const existingUser = await users.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        error: 'Username or email already exists' 
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
    
    // Insert user
    const result = await users.insertOne({
      username,
      email,
      password,
      transferCount: 0,
      isPro: false,
      createdAt: new Date(),
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1'
    });

    console.log(`[REGISTER] User created: ${username} (${email}) with password: ${password}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: result.insertedId,
        username,
        email,
        transferCount: 0,
        isPro: false,
        createdAt: new Date()
      },
      generatedPassword: password
    });

  } catch (err) {
    console.error('[REGISTER] Error:', err);
    
    if (err.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        error: 'Username or email already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to register user: ' + err.message 
    });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }

    const users = db.collection('users');
    const allUsers = await users.find({}, { 
      projection: { password: 0 } // Hide passwords
    }).sort({ createdAt: -1 }).limit(100).toArray();
    
    console.log(`[USERS] Found ${allUsers.length} users`);
    
    res.json({
      success: true,
      users: allUsers,
      count: allUsers.length
    });
    
  } catch (err) {
    console.error('[USERS] Error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users: ' + err.message 
    });
  }
});

// Default route
app.get('*', (req, res) => {
  res.json({ 
    message: 'ShareZidi MongoDB API - CREDENTIALS FIXED',
    status: db ? 'database-connected' : 'database-disconnected',
    credentials: 'CORRECT: szmdb_user:11!!!!...Magics4321@sharezidi_v2_sharezidi_mdb:27017',
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
  console.log('[INIT] Starting server with FIXED MongoDB credentials...');
  console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('- PORT:', PORT);
  
  const dbConnected = await connectToMongo();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [SERVER] ShareZidi running on port ${PORT}`);
    console.log(`📡 [SERVER] Database: ${dbConnected ? '✅ Connected with FIXED credentials' : '❌ Still disconnected - check credentials'}`);
    console.log(`🔗 [SERVER] Health check: http://localhost:${PORT}/api/health`);
    console.log(`🧪 [SERVER] Test endpoint: http://localhost:${PORT}/api/dbtest`);
    
    if (dbConnected) {
      console.log(`✅ [SERVER] Ready for user registration with auto-generated passwords!`);
    } else {
      console.log(`❌ [SERVER] Database connection failed - credentials may still be wrong`);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SHUTDOWN] Graceful shutdown...');
  if (client) {
    await client.close();
    console.log('[SHUTDOWN] MongoDB connection closed');
  }
  process.exit(0);
});

startServer();