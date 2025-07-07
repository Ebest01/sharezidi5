const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createServer } = require('http');

// Environment validation
const requiredEnvVars = ['DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`[INIT] ShareZidi starting in ${process.env.NODE_ENV || 'development'} mode`);

// Database setup with proper error handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

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

// Serve static files if they exist
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
    database: pool.totalCount > 0 ? 'connected' : 'disconnected'
  });
});

// Database test endpoint
app.get('/api/dbtest', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    
    res.json({ 
      success: true, 
      database: 'connected',
      currentTime: result.rows[0].current_time,
      pgVersion: result.rows[0].pg_version,
      userCount: parseInt(userCount.rows[0].count),
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
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
    const digits = '0123456789';
    
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

    // Basic geolocation data (simplified)
    const locationData = {
      ip: clientIP,
      country: 'Unknown',
      city: 'Unknown',
      timezone: 'UTC'
    };

    // Insert user with all required fields
    const result = await pool.query(`
      INSERT INTO users (
        username, email, password, 
        ip_address, country, city, timezone,
        transfer_count, is_pro, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, false, NOW()) 
      RETURNING id, username, email, transfer_count, is_pro, created_at`,
      [
        username, email, password,
        locationData.ip, locationData.country, locationData.city, locationData.timezone
      ]
    );
    
    console.log(`[REGISTER] New user: ${username} (${email}) from ${clientIP}`);
    
    res.json({ 
      success: true, 
      user: result.rows[0],
      generatedPassword: password,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('[REGISTER] Error:', error.message);
    
    if (error.code === '23505') { // Unique violation
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
    const result = await pool.query(`
      SELECT id, username, email, transfer_count, is_pro, 
             country, city, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 100
    `);
    
    res.json({ 
      success: true, 
      users: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('[USERS] Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Fallback route - serve index.html for frontend routing
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

// Add WebSocket support
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
      
      // Echo back for testing
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
  
  ws.on('error', (error) => {
    console.error('[WS] Error:', error.message);
  });
});

// Database connection test
async function testDatabase() {
  try {
    console.log('[DB] Testing connection...');
    const result = await pool.query('SELECT NOW() as time');
    console.log(`[DB] ✅ Connected successfully at ${result.rows[0].time}`);
    
    // Test users table
    try {
      const userResult = await pool.query('SELECT COUNT(*) as count FROM users');
      console.log(`[DB] ✅ Users table accessible (${userResult.rows[0].count} users)`);
    } catch (tableError) {
      console.log('[DB] ⚠️  Users table not found - may need migration');
    }
    
    return true;
  } catch (error) {
    console.error('[DB] ❌ Connection failed:', error.message);
    return false;
  }
}

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('[SHUTDOWN] Graceful shutdown initiated');
  server.close(async () => {
    console.log('[SHUTDOWN] HTTP server closed');
    try {
      await pool.end();
      console.log('[SHUTDOWN] Database pool closed');
    } catch (error) {
      console.error('[SHUTDOWN] Database close error:', error.message);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function startServer() {
  const dbConnected = await testDatabase();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] ✅ ShareZidi running on port ${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SERVER] Database: ${dbConnected ? '✅' : '❌'} ${dbConnected ? 'Connected' : 'Disconnected'}`);
    console.log(`[SERVER] WebSocket: ✅ Ready on /ws`);
    console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[SERVER] Database test: http://localhost:${PORT}/api/dbtest`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught Exception:', error);
  gracefulShutdown();
});

startServer();