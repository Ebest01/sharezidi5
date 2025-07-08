// Production server with Vite dev server for React app
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`[PRODUCTION] Starting ShareZidi production server on port ${PORT}`);

// MongoDB connection
const MONGO_URI = 'mongodb://shzmdb2:11xxshzMDB@sharezidi_v2_shzidi_mdb2:27017/?ssl=false';
let mongoClient = null;
let isConnected = false;

async function connectToMongo() {
  try {
    console.log(`[MONGO] Connecting to MongoDB...`);
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    isConnected = true;
    console.log(`[MONGO] ✅ Connected successfully!`);
  } catch (error) {
    console.error(`[MONGO] ❌ Connection failed:`, error.message);
    isConnected = false;
  }
}

connectToMongo();

// Basic middleware
app.use(express.json());

// Start Vite dev server for React TypeScript compilation
console.log(`[PRODUCTION] Starting Vite dev server for React TypeScript compilation...`);
const viteProcess = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], {
  stdio: 'pipe',
  cwd: __dirname
});

// Log Vite output
viteProcess.stdout.on('data', (data) => {
  console.log(`[VITE] ${data.toString().trim()}`);
});

viteProcess.stderr.on('data', (data) => {
  console.log(`[VITE ERROR] ${data.toString().trim()}`);
});

// Give Vite time to start
setTimeout(() => {
  console.log(`[PRODUCTION] Vite dev server running on port 5173 for TypeScript compilation`);
}, 3000);

// Proxy React app requests to Vite dev server for TypeScript compilation
app.use('/', (req, res, next) => {
  // Handle API routes and database test directly
  if (req.path.startsWith('/api/') || req.path.startsWith('/simpledbtest')) {
    return next();
  }
  
  // Proxy React app requests to Vite for TypeScript compilation
  const fetch = require('node-fetch');
  const viteUrl = `http://localhost:5173${req.path}`;
  
  fetch(viteUrl)
    .then(viteRes => {
      res.status(viteRes.status);
      viteRes.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      return viteRes.text();
    })
    .then(content => res.send(content))
    .catch(err => {
      console.log(`[VITE PROXY] Error for ${req.path}: ${err.message}`);
      // Fallback - serve static index.html if Vite fails
      if (req.path === '/' || !req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'index.html'));
      } else {
        res.status(503).send('React app starting...');
      }
    });
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'running',
    mongodb: isConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/register', async (req, res) => {
  if (!isConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { email, password, username } = req.body;
    const db = mongoClient.db('sharezidi');
    const users = db.collection('users');
    
    const user = {
      email,
      username: username || email.split('@')[0],
      password,
      createdAt: new Date()
    };
    
    const result = await users.insertOne(user);
    res.json({ success: true, userId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  if (!isConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const db = mongoClient.db('sharezidi');
    const users = db.collection('users');
    const userList = await users.find({}).limit(10).toArray();
    res.json({ success: true, users: userList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database test page
app.get('/simpledbtest', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <title>ShareZidi - Database Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .buttons { display: flex; gap: 15px; justify-content: center; margin: 30px 0; }
        button { padding: 12px 24px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; background: #007bff; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 ShareZidi Database Test</h1>
        <div class="buttons">
            <button onclick="generateUser()">Generate Random User</button>
            <button onclick="addUserToDB()">Add to DB</button>
            <button onclick="showAllUsers()">Show All Users</button>
        </div>
        <div id="output">Ready for testing...</div>
    </div>
    <script>
        let currentUser = null;
        function generateUser() {
            const email = 'user' + Math.floor(Math.random() * 10000) + '@gmail.com';
            currentUser = { email, password: 'pass123' };
            document.getElementById('output').textContent = 'Generated: ' + email;
        }
        async function addUserToDB() {
            if (!currentUser) return;
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentUser)
            });
            const data = await response.json();
            document.getElementById('output').textContent = JSON.stringify(data, null, 2);
        }
        async function showAllUsers() {
            const response = await fetch('/api/users');
            const data = await response.json();
            document.getElementById('output').textContent = JSON.stringify(data, null, 2);
        }
    </script>
</body>
</html>`);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[PRODUCTION] ✅ ShareZidi production server running on http://0.0.0.0:${PORT}`);
  console.log(`[PRODUCTION] ✅ React app proxied from Vite dev server on port 5173`);
  console.log(`[PRODUCTION] ✅ MongoDB: ${isConnected ? 'Connected' : 'Checking...'}`);
});

// Cleanup on exit
process.on('SIGTERM', () => {
  console.log('[PRODUCTION] Shutting down...');
  if (viteProcess) viteProcess.kill();
  if (mongoClient) mongoClient.close();
  process.exit(0);
});