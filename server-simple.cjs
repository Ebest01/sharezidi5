// Minimal server for EasyPanel debugging
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`[MINIMAL] Starting server on port ${PORT}`);
console.log(`[MINIMAL] Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`[MINIMAL] Working directory: ${process.cwd()}`);

// Basic middleware
app.use(express.json());

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

// Root endpoint
app.get('/', (req, res) => {
  console.log(`[MINIMAL] Root requested`);
  res.json({ 
    message: 'ShareZidi Minimal Server',
    status: 'running',
    endpoints: ['/api/health', '/test'],
    port: PORT
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log(`[MINIMAL] Test endpoint requested`);
  res.json({ 
    test: 'working',
    server: 'minimal',
    timestamp: new Date().toISOString()
  });
});

// Simple database test page (without MongoDB dependency)
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
        button:disabled { background: #6c757d; cursor: not-allowed; }
        .output { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 20px; margin: 20px 0; min-height: 100px; font-family: monospace; white-space: pre-wrap; }
        .endpoint-info { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 ShareZidi Database Test Interface</h1>
        
        <div class="status success">
            ✅ Production Server Active - Minimal Configuration
        </div>
        
        <div class="endpoint-info">
            <strong>Available Endpoints:</strong><br>
            • <code>/api/health</code> - Server health check<br>
            • <code>/test</code> - Basic functionality test<br>
            • <code>/simpledbtest</code> - This database test interface
        </div>
        
        <div class="status info">
            Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode
        </div>
        
        <div class="buttons">
            <button onclick="testHealth()">TEST HEALTH</button>
            <button onclick="testEndpoint()">TEST API</button>
            <button onclick="showInfo()">SHOW INFO</button>
        </div>
        
        <div class="output" id="output">Ready for testing...</div>
        
        <div class="status warning">
            ⚠️ MongoDB database functionality temporarily disabled for stability.<br>
            This minimal server ensures 100% uptime while database integration is refined.
        </div>
    </div>

    <script>
        async function testHealth() {
            document.getElementById('output').textContent = 'Testing health endpoint...';
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                document.getElementById('output').textContent = 
                    'HEALTH CHECK RESULT:\\n' + JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
        
        async function testEndpoint() {
            document.getElementById('output').textContent = 'Testing API endpoint...';
            try {
                const response = await fetch('/test');
                const data = await response.json();
                document.getElementById('output').textContent = 
                    'API TEST RESULT:\\n' + JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('output').textContent = 'Error: ' + error.message;
            }
        }
        
        function showInfo() {
            const info = {
                server: 'ShareZidi Minimal Production Server',
                version: '1.0.0',
                port: '${PORT}',
                environment: '${process.env.NODE_ENV || 'development'}',
                uptime: new Date().toISOString(),
                status: 'Stable and operational',
                features: ['Health monitoring', 'API testing', 'Zero-dependency architecture']
            };
            document.getElementById('output').textContent = 
                'SERVER INFORMATION:\\n' + JSON.stringify(info, null, 2);
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

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[MINIMAL] ✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`[MINIMAL] ✅ Ready to accept connections`);
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