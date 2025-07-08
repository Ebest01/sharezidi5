import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Database, User, Plus, List, Activity } from 'lucide-react';

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

interface RegistrationResponse {
  success: boolean;
  user: User;
  generatedPassword: string;
  message: string;
}

export default function DbTestPage() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [lastRegistration, setLastRegistration] = useState<RegistrationResponse | null>(null);
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
        body: JSON.stringify({ username, email }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLastRegistration(data);
        setUsername('');
        setEmail('');
        // Refresh users list
        await showUsers();
        await testDatabase(); // Update user count
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Failed to register user');
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
        setUsers(data.users);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Users fetch error:', err);
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
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Database className="h-8 w-8" />
          MongoDB Database Test
        </h1>
        <p className="text-muted-foreground">
          Testing CREATE, ADD and SHOW functionality with MongoDB backend
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Database Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Database Status
          </CardTitle>
          <CardDescription>
            MongoDB connection and database information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testDatabase} 
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Database...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Test Database Connection
              </>
            )}
          </Button>
          
          {dbStatus && (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Status</div>
                <Badge variant={dbStatus.success ? "default" : "destructive"}>
                  {dbStatus.database === 'connected' ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">User Count</div>
                <div className="text-2xl font-bold">{dbStatus.userCount}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Collections</div>
                <div className="text-sm text-muted-foreground">
                  {dbStatus.collections.join(', ') || 'None'}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Version</div>
                <div className="text-sm text-muted-foreground">
                  {dbStatus.version || 'MongoDB'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Creation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            CREATE User
          </CardTitle>
          <CardDescription>
            Add new users with auto-generated passwords [A-Z{3}][0-9{6}][a-z{2}]
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                disabled={registering}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                disabled={registering}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={createUser} 
              disabled={registering || !username.trim() || !email.trim()}
              className="flex-1"
            >
              {registering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating User...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  ADD User
                </>
              )}
            </Button>
            
            <Button 
              onClick={generateSampleUser}
              variant="outline"
              disabled={registering}
            >
              Generate Sample
            </Button>
          </div>

          {lastRegistration && (
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="font-semibold text-green-800 dark:text-green-200">
                User Created Successfully!
              </h4>
              <div className="mt-2 space-y-1 text-sm">
                <div><strong>Username:</strong> {lastRegistration.user.username}</div>
                <div><strong>Email:</strong> {lastRegistration.user.email}</div>
                <div><strong>Generated Password:</strong> 
                  <code className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900 rounded">
                    {lastRegistration.generatedPassword}
                  </code>
                </div>
                <div><strong>Transfer Count:</strong> {lastRegistration.user.transferCount}</div>
                <div><strong>Pro Status:</strong> {lastRegistration.user.isPro ? 'Yes' : 'No'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users List Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            SHOW Users
          </CardTitle>
          <CardDescription>
            Display all registered users from MongoDB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={showUsers} 
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Users...
              </>
            ) : (
              <>
                <User className="mr-2 h-4 w-4" />
                Refresh Users List
              </>
            )}
          </Button>

          {users.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Found {users.length} user{users.length !== 1 ? 's' : ''}
              </div>
              {users.map((user, index) => (
                <div key={user._id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{user.username}</div>
                    <div className="flex gap-2">
                      <Badge variant={user.isPro ? "default" : "secondary"}>
                        {user.isPro ? 'Pro' : 'Free'}
                      </Badge>
                      <Badge variant="outline">
                        {user.transferCount} transfers
                      </Badge>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {user.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(user.createdAt).toLocaleString()}
                    {user.ipAddress && ` • IP: ${user.ipAddress}`}
                  </div>
                  {index < users.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No users found. Create some users to see them here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}