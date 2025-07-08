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
    message: 'ShareZidi Database Test Server',
    status: 'running',
    endpoints: ['/api/health', '/test', '/simpledbtest'],
    port: PORT,
    version: '2.0.0',
    deployed: new Date().toISOString()
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

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[MINIMAL] ✅ ShareZidi Database Test Server running on http://0.0.0.0:${PORT}`);
  console.log(`[MINIMAL] ✅ Endpoints: /api/health, /test, /simpledbtest`);
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