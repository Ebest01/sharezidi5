// Minimal server for EasyPanel debugging
const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`[MINIMAL] Starting server on port ${PORT}`);
console.log(`[MINIMAL] Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`[MINIMAL] Working directory: ${process.cwd()}`);

// MongoDB connection
let db = null;

// Robust production approach with internal/external fallback:
const MONGO_INTERNAL = 'mongodb://shzmdb2:11xxshzMDB@sharezidi_v2_shzidi_mdb2:27017/?ssl=false';
const MONGO_EXTERNAL = 'mongodb://shzmdb2:11xxshzMDB@193.203.165.217:27017/?ssl=false';

async function connectToMongo() {
  // Try internal first (preferred for performance)
  try {
    console.log('[MONGO] Attempting internal connection...');
    const client = new MongoClient(MONGO_INTERNAL, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db('sharezidi');
    
    // Test the connection
    await db.command({ ping: 1 });
    console.log('[MONGO] ✅ Connected via INTERNAL network');
    
    // Test collection access
    const testResult = await db.collection('users').countDocuments();
    console.log('[MONGO] ✅ Users collection accessible, document count:', testResult);
    return;
  } catch (error) {
    console.log('[MONGO] Internal failed:', error.message);
  }
  
  // Fallback to external (working solution)
  try {
    console.log('[MONGO] Attempting external connection...');
    const client = new MongoClient(MONGO_EXTERNAL, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });
    await client.connect();
    db = client.db('sharezidi');
    
    // Test the connection
    await db.command({ ping: 1 });
    console.log('[MONGO] ✅ Connected via EXTERNAL network');
    
    // Test collection access
    const testResult = await db.collection('users').countDocuments();
    console.log('[MONGO] ✅ Users collection accessible, document count:', testResult);
  } catch (error) {
    console.error('[MONGO] ❌ Both connections failed!');
    console.error('[MONGO] ❌ External error:', error.message);
    db = null;
    throw error;
  }
}

connectToMongo();

// Basic middleware
app.use(express.json());

// Serve static files with proper MIME types
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/src', express.static(path.join(__dirname, 'src'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.tsx') || path.endsWith('.ts')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    if (path.endsWith('.jsx') || path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));
console.log('[STATIC] Serving /src from:', path.join(__dirname, 'src'));

// Check for built React app
const builtPath = path.join(__dirname, 'dist', 'public');
if (fs.existsSync(builtPath)) {
  console.log(`[MINIMAL] Serving built React app from: ${builtPath}`);
  app.use(express.static(builtPath));
}

// Health check without MongoDB
app.get('/api/health', (req, res) => {
  console.log(`[MINIMAL] Health check requested`);
  res.json({ 
    status: 'ok', 
    server: 'minimal',
    port: PORT,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Check for React app files
const indexPath = path.join(__dirname, 'index.html');
const builtIndexPath = path.join(__dirname, 'dist', 'public', 'index.html');
const hasReactApp = fs.existsSync(indexPath);
const hasBuiltApp = fs.existsSync(builtIndexPath);

console.log(`[MINIMAL] React app check: index.html=${hasReactApp}, built=${hasBuiltApp}`);

// Serve the React application for main routes ONLY (not static files)
if (hasBuiltApp) {
  // Production: serve built React app
  app.get(['/', '/auth', '/start', '/login'], (req, res) => {
    console.log(`[MINIMAL] Serving built React app for: ${req.path}`);
    res.sendFile(builtIndexPath);
  });
} else if (hasReactApp) {
  // Development: serve development React app
  app.get(['/', '/auth', '/start', '/login'], (req, res) => {
    console.log(`[MINIMAL] Serving dev React app for: ${req.path}`);
    res.sendFile(indexPath);
  });
} else {
  // Fallback: serve JSON response if no React app
  app.get('/', (req, res) => {
    console.log(`[MINIMAL] Root requested (no React app found)`);
    res.json({ 
      message: 'ShareZidi Database Test Server',
      status: 'running',
      endpoints: ['/api/health', '/test', '/simpledbtest', '/api/register', '/api/users'],
      port: PORT,
      version: '2.1.0',
      deployed: new Date().toISOString(),
      note: 'React app not built. Run npm run build to enable full UI.'
    });
  });
}

// Test endpoint
app.get('/test', (req, res) => {
  console.log(`[MINIMAL] Test endpoint requested`);
  res.json({ 
    test: 'working',
    server: 'minimal',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to test static file serving
app.get('/debug/files', (req, res) => {
  const srcPath = path.join(__dirname, 'src');
  const mainJsPath = path.join(srcPath, 'main.js');
  
  console.log('[DEBUG] Checking file system:');
  console.log(`[DEBUG] __dirname: ${__dirname}`);
  console.log(`[DEBUG] srcPath: ${srcPath}`);
  console.log(`[DEBUG] mainJsPath: ${mainJsPath}`);
  console.log(`[DEBUG] src exists: ${fs.existsSync(srcPath)}`);
  console.log(`[DEBUG] main.js exists: ${fs.existsSync(mainJsPath)}`);
  
  res.json({
    __dirname: __dirname,
    srcPath: srcPath,
    mainJsPath: mainJsPath,
    srcExists: fs.existsSync(srcPath),
    mainJsExists: fs.existsSync(mainJsPath),
    srcContents: fs.existsSync(srcPath) ? fs.readdirSync(srcPath) : 'directory not found'
  });
});

// Register user endpoint
app.post('/api/register', async (req, res) => {
  console.log(`[MINIMAL] Register user requested:`, req.body);
  const { email, password, username } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }
  
  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected'
    });
  }
  
  try {
    const newUser = {
      email: email,
      username: username || email.split('@')[0],
      password: password, // In production, this should be hashed
      createdAt: new Date(),
      transferCount: 0,
      isPro: false
    };
    
    const result = await db.collection('users').insertOne(newUser);
    console.log(`[MONGO] ✅ User created with ID:`, result.insertedId);
    
    res.json({
      success: true,
      message: 'User registered successfully',
      user: {
        _id: result.insertedId,
        email: newUser.email,
        username: newUser.username,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error(`[MONGO] ❌ Registration error:`, error);
    
    if (error.code === 11000) { // MongoDB duplicate key error
      res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Registration failed: ' + error.message
      });
    }
  }
});

// Get users endpoint
app.get('/api/users', async (req, res) => {
  console.log(`[MINIMAL] Get users requested`);
  
  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
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
      email: user.email,
      username: user.username,
      password: user.password, // Showing password for testing purposes only
      createdAt: user.createdAt,
      transferCount: user.transferCount || 0,
      isPro: user.isPro || false
    }));

    console.log(`[MONGO] ✅ Retrieved ${formattedUsers.length} users from database`);
    
    res.json({
      success: true,
      users: formattedUsers,
      count: formattedUsers.length
    });
  } catch (error) {
    console.error(`[MONGO] ❌ Get users error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users: ' + error.message,
      users: []
    });
  }
});

// Simple database test page
app.get('/simpledbtest', (req, res) => {
  console.log(`[MINIMAL] Database test page requested`);
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
            ✅ Production Server Active - Port ${PORT}
        </div>
        
        <div class="status info">
            Testing database operations: Generate → Add → Show user data
        </div>
        
        <div class="buttons">
            <button onclick="generateUser()">Generate Random User</button>
            <button onclick="addUserToDB()">Add Generated User to DB</button>
            <button onclick="showAllUsers()">Show All Users from DB</button>
        </div>
        
        <div id="generatedUser" class="output" style="display:none;">
            <h3>Generated User:</h3>
            <p><strong>Email:</strong> <span id="userEmail"></span></p>
            <p><strong>Password:</strong> <span id="userPassword"></span></p>
        </div>
        
        <div class="output" id="output">Ready for database testing...</div>
        
        <div class="status warning">
            Click buttons above to test database operations
        </div>
    </div>

    <script>
        let currentUser = null;
        
        function generateUser() {
            const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
            const randomName = 'user' + Math.floor(Math.random() * 10000);
            const randomDomain = domains[Math.floor(Math.random() * domains.length)];
            const email = randomName + '@' + randomDomain;
            const password = 'pass' + Math.floor(Math.random() * 100000);
            
            currentUser = { email, password };
            
            document.getElementById('userEmail').textContent = email;
            document.getElementById('userPassword').textContent = password;
            document.getElementById('generatedUser').style.display = 'block';
            document.getElementById('output').textContent = 'Random user generated successfully!';
        }
        
        async function addUserToDB() {
            if (!currentUser) {
                document.getElementById('output').textContent = 'Please generate a user first!';
                return;
            }
            
            document.getElementById('output').textContent = 'Adding user to database...';
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: currentUser.email,
                        password: currentUser.password,
                        username: currentUser.email.split('@')[0]
                    })
                });
                
                const data = await response.json();
                document.getElementById('output').textContent = 
                    'ADD USER RESULT:\\n' + JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('output').textContent = 'Error adding user: ' + error.message;
            }
        }
        
        async function showAllUsers() {
            document.getElementById('output').textContent = 'Fetching all users from database...';
            try {
                const response = await fetch('/api/users');
                const data = await response.json();
                
                if (data.success && data.users) {
                    let userList = 'ALL USERS FROM DATABASE:\\n\\n';
                    data.users.forEach((user, index) => {
                        userList += \`User \${index + 1}:\\n\`;
                        userList += \`  Email: \${user.email}\\n\`;
                        userList += \`  Username: \${user.username}\\n\`;
                        userList += \`  Created: \${user.createdAt}\\n\\n\`;
                    });
                    userList += \`Total Users: \${data.users.length}\`;
                    document.getElementById('output').textContent = userList;
                } else {
                    document.getElementById('output').textContent = 
                        'SHOW USERS RESULT:\\n' + JSON.stringify(data, null, 2);
                }
            } catch (error) {
                document.getElementById('output').textContent = 'Error fetching users: ' + error.message;
            }
        }
    </script>
</body>
</html>
  `);
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`[MINIMAL] Error:`, err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message
  });
});

// Catch-all handler for client-side routing (must be last)
if (hasBuiltApp || hasReactApp) {
  app.get('*', (req, res) => {
    // Only serve React app for non-API routes
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/simpledbtest')) {
      const servePath = hasBuiltApp ? builtIndexPath : indexPath;
      console.log(`[MINIMAL] Serving React app for catch-all route: ${req.path}`);
      res.sendFile(servePath);
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[MINIMAL] ✅ ShareZidi Database Test Server running on http://0.0.0.0:${PORT}`);
  console.log(`[MINIMAL] ✅ Endpoints: /api/health, /test, /simpledbtest, /api/register, /api/users`);
  console.log(`[MINIMAL] ✅ React app: ${hasReactApp ? 'Available' : 'Not built'}`);
});

server.on('error', (err) => {
  console.error(`[MINIMAL] ❌ Server error:`, err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(`[MINIMAL] ❌ Uncaught exception:`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[MINIMAL] ❌ Unhandled rejection at:`, promise, 'reason:', reason);
  process.exit(1);
});