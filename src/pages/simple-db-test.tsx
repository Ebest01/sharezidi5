import { useState, useEffect } from 'react';

interface User {
  _id: string;
  username: string;
  email: string;
  transferCount: number;
  isPro: boolean;
  createdAt: string;
  ipAddress?: string;
}

interface DbStatus {
  success: boolean;
  database: string;
  userCount: number;
  collections: string[];
  version?: string;
}

export default function SimpleDbTestPage() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Test database connection
  const testDatabase = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/dbtest');
      const data = await response.json();
      
      if (data.success) {
        setDbStatus(data);
      } else {
        setError(data.error || 'Database test failed');
      }
    } catch (err) {
      setError('Failed to connect to database');
      console.error('Database test error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create/Register new user
  const createUser = async () => {
    if (!username.trim() || !email.trim()) {
      setError('Username and email are required');
      return;
    }

    setRegistering(true);
    setError(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`User created successfully! Password: ${data.generatedPassword}`);
        setUsername('');
        setEmail('');
        await showUsers(); // Refresh user list
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Failed to create user');
      console.error('Registration error:', err);
    } finally {
      setRegistering(false);
    }
  };

  // Show all users
  const showUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users');
      const data = await response.json();

      if (data.success) {
        setUsers(data.users || []);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate sample user data
  const generateSampleUser = () => {
    const sampleUsernames = ['testuser', 'demouser', 'sampleuser', 'mongouser', 'shareuser'];
    const sampleDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'test.com'];
    
    const randomUsername = sampleUsernames[Math.floor(Math.random() * sampleUsernames.length)] + 
                          Math.floor(Math.random() * 1000);
    const randomEmail = `${randomUsername}@${sampleDomains[Math.floor(Math.random() * sampleDomains.length)]}`;
    
    setUsername(randomUsername);
    setEmail(randomEmail);
  };

  // Load database status on mount
  useEffect(() => {
    testDatabase();
    showUsers();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        📊 MongoDB Database Test
      </h1>
      
      {error && (
        <div style={{ 
          backgroundColor: '#fee', 
          color: '#c33', 
          padding: '10px', 
          marginBottom: '20px',
          border: '1px solid #fcc',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {/* Database Status */}
      <div style={{ 
        border: '1px solid #ddd', 
        padding: '20px', 
        marginBottom: '20px',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <h2>🔍 Database Status</h2>
        <button 
          onClick={testDatabase} 
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '15px'
          }}
        >
          {loading ? 'Testing...' : 'Test Database Connection'}
        </button>
        
        {dbStatus && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <strong>Status:</strong>{' '}
              <span style={{ 
                color: dbStatus.success ? '#28a745' : '#dc3545',
                fontWeight: 'bold'
              }}>
                {dbStatus.database === 'connected' ? 'Connected ✅' : 'Disconnected ❌'}
              </span>
            </div>
            <div>
              <strong>User Count:</strong> {dbStatus.userCount}
            </div>
            <div>
              <strong>Collections:</strong> {dbStatus.collections.join(', ') || 'None'}
            </div>
            <div>
              <strong>Version:</strong> {dbStatus.version || 'MongoDB'}
            </div>
          </div>
        )}
      </div>

      {/* Create User */}
      <div style={{ 
        border: '1px solid #ddd', 
        padding: '20px', 
        marginBottom: '20px',
        borderRadius: '8px',
        backgroundColor: '#f0f8ff'
      }}>
        <h2>➕ Create User</h2>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Username:
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginBottom: '10px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Email:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginBottom: '10px'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={createUser}
            disabled={registering}
            style={{
              padding: '10px 20px',
              backgroundColor: registering ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: registering ? 'not-allowed' : 'pointer'
            }}
          >
            {registering ? 'Creating...' : 'CREATE USER'}
          </button>
          
          <button
            onClick={generateSampleUser}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Generate Sample Data
          </button>
        </div>
      </div>

      {/* User List */}
      <div style={{ 
        border: '1px solid #ddd', 
        padding: '20px',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        <h2>👥 User List</h2>
        <button
          onClick={showUsers}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '15px'
          }}
        >
          {loading ? 'Loading...' : 'SHOW USERS'}
        </button>

        {users.length > 0 ? (
          <div>
            <p style={{ color: '#666', marginBottom: '15px' }}>
              Found {users.length} user{users.length !== 1 ? 's' : ''}
            </p>
            {users.map((user, index) => (
              <div key={user._id} style={{
                border: '1px solid #ddd',
                padding: '15px',
                marginBottom: '10px',
                borderRadius: '4px',
                backgroundColor: 'white'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold' }}>{user.username}</div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      backgroundColor: user.isPro ? '#28a745' : '#6c757d',
                      color: 'white'
                    }}>
                      {user.isPro ? 'Pro' : 'Free'}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      backgroundColor: '#e9ecef',
                      color: '#495057',
                      border: '1px solid #ced4da'
                    }}>
                      {user.transferCount} transfers
                    </span>
                  </div>
                </div>
                <div style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
                  {user.email}
                </div>
                <div style={{ color: '#999', fontSize: '12px', marginTop: '5px' }}>
                  Created: {new Date(user.createdAt).toLocaleString()}
                  {user.ipAddress && ` • IP: ${user.ipAddress}`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            No users found. Create some users to see them here.
          </div>
        )}
      </div>
    </div>
  );
}