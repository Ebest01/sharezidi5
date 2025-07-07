const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createServer } = require('http');

// Environment validation
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist/public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database test endpoint
app.get('/api/dbtest', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ 
      success: true, 
      database: 'connected',
      time: result.rows[0].current_time 
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({ 
      success: false, 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// User registration endpoint (simplified)
app.post('/api/register', async (req, res) => {
  try {
    const { username, email } = req.body;
    
    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    // Generate simple password
    const password = 'ABC' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0') + 'xy';
    
    // Insert user (simplified schema)
    const result = await pool.query(
      'INSERT INTO users (username, email, password, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, username, email',
      [username, email, password]
    );
    
    res.json({ 
      success: true, 
      user: result.rows[0],
      generatedPassword: password
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Create HTTP server
const server = createServer(app);

// Add WebSocket support
const wss = new WebSocketServer({ 
  server: server, 
  path: '/ws' 
});

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('WebSocket message:', message.type);
      
      // Echo back for testing
      ws.send(JSON.stringify({ 
        type: 'echo', 
        data: message 
      }));
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    console.log('[DATABASE] Testing connection...');
    await pool.query('SELECT 1');
    console.log('[DATABASE] ✅ Connected successfully');
    
    // Start HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] ✅ ShareZidi running on port ${PORT}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[SERVER] Database: ✅ Connected`);
      console.log(`[SERVER] WebSocket: ✅ Ready on /ws`);
    });
  } catch (error) {
    console.error('[DATABASE] ❌ Connection failed:', error);
    console.log('[WARNING] Starting server without database connection');
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] ⚠️  ShareZidi running on port ${PORT} (no database)`);
    });
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    pool.end();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    pool.end();
    process.exit(0);
  });
});

startServer();