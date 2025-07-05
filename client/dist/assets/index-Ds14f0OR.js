// ShareZidi Production Frontend
console.log("ShareZidi loading...");

let currentUser = null;

// Router for single-page app
function navigate(path) {
  window.history.pushState(null, '', path);
  renderCurrentPage();
}

function renderCurrentPage() {
  const path = window.location.pathname;
  const root = document.getElementById('root');
  
  if (path === '/login' || path === '/auth') {
    renderLoginPage(root);
  } else if (path === '/start' && currentUser) {
    renderTransferPage(root);
  } else {
    renderLandingPage(root);
  }
}

function renderLandingPage(root) {
  root.innerHTML = `
    <div class="landing-container">
      <header class="landing-header">
        <div class="logo">
          <h1>ShareZidi</h1>
          <p class="tagline">Real-time File Transfer Made Simple</p>
        </div>
      </header>
      
      <main class="landing-main">
        <section class="hero">
          <h2>Share Files Instantly Between Devices</h2>
          <p class="hero-description">
            Transfer files seamlessly between your phone, laptop, and tablet. 
            No cables, no cloud storage, just direct peer-to-peer sharing.
          </p>
          
          <div class="cta-buttons">
            ${currentUser ? 
              '<button onclick="navigate(\'/start\')" class="cta-primary">Start Transfer</button><span class="user-info">Welcome back, ' + currentUser.username + '!</span>' :
              '<button onclick="navigate(\'/login\')" class="cta-primary">Get Started</button><button onclick="startGuestMode()" class="cta-secondary">Try as Guest</button>'
            }
          </div>
        </section>
        
        <section class="features">
          <div class="feature">
            <h3>⚡ Lightning Fast</h3>
            <p>Direct device-to-device transfer with optimized chunking</p>
          </div>
          <div class="feature">
            <h3>🔒 Secure</h3>
            <p>End-to-end encrypted transfers with no cloud storage</p>
          </div>
          <div class="feature">
            <h3>📱 Cross-Platform</h3>
            <p>Works on mobile, desktop, and tablet devices</p>
          </div>
        </section>
      </main>
      
      <footer class="landing-footer">
        <p>&copy; ` + new Date().getFullYear() + ` ShareZidi. All rights reserved.</p>
        <div class="footer-links">
          <a href="/health" onclick="checkHealth(); return false;">Server Status</a>
        </div>
      </footer>
    </div>
  `;
}

function renderLoginPage(root) {
  root.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <h2>Welcome to ShareZidi</h2>
        <p>Sign in to start transferring files</p>
        
        <form id="loginForm" class="auth-form">
          <div class="form-group">
            <label for="email">Email or Username</label>
            <input type="text" id="email" name="email" required placeholder="Enter your email or username">
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required placeholder="Enter your password">
          </div>
          
          <button type="submit" class="auth-button">Sign In</button>
        </form>
        
        <div class="auth-hint">
          <p><strong>Development Access:</strong></p>
          <p>Username: <code>AxDMIxN</code> | Password: <code>AZQ00001xx</code></p>
        </div>
        
        <div class="auth-footer">
          <button onclick="navigate('/')" class="link-button">← Back to Home</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

function renderTransferPage(root) {
  root.innerHTML = `
    <div class="transfer-container">
      <header class="transfer-header">
        <h1>ShareZidi Transfer</h1>
        <div class="user-menu">
          <span>Hello, ` + currentUser.username + `</span>
          <button onclick="logout()" class="logout-btn">Logout</button>
        </div>
      </header>
      
      <main class="transfer-main">
        <div class="transfer-status">
          <h2>Ready to Transfer Files</h2>
          <p>Your devices will appear here when they connect.</p>
        </div>
        
        <div class="file-selector">
          <div class="drop-zone">
            <p>Drag files here or click to select</p>
            <input type="file" multiple style="display: none;">
          </div>
        </div>
      </main>
    </div>
  `;
}

function startGuestMode() {
  currentUser = { username: 'Guest', isGuest: true };
  navigate('/start');
}

function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const email = formData.get('email');
  const password = formData.get('password');
  
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      currentUser = data.user;
      navigate('/start');
    } else {
      alert('Login failed: ' + (data.error || 'Invalid credentials'));
    }
  })
  .catch(error => {
    console.error('Login error:', error);
    alert('Login failed: ' + error.message);
  });
}

function logout() {
  fetch('/api/auth/logout', { method: 'POST' })
    .then(() => {
      currentUser = null;
      navigate('/');
    });
}

// Health check function
window.checkHealth = function() {
  fetch('/health')
    .then(response => response.json())
    .then(data => {
      console.log('Health check:', data);
      alert('Server Status: ' + data.status + '\\nUptime: ' + Math.round(data.uptime) + 's\\nSessions: ' + data.activeSessions);
    })
    .catch(error => {
      console.error('Health check failed:', error);
      alert('Health check failed: ' + error.message);
    });
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is already logged in
  fetch('/api/auth/user')
    .then(response => response.json())
    .then(data => {
      if (data.username && !data.isGuest) {
        currentUser = data;
      }
      renderCurrentPage();
    })
    .catch(error => {
      console.error('Auth check failed:', error);
      renderCurrentPage();
    });
  
  // Handle browser back/forward
  window.addEventListener('popstate', renderCurrentPage);
});

console.log("ShareZidi production frontend loaded");