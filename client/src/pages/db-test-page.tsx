import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface User {
  id: number;
  email: string;
  password?: string;
  createdAt?: string;
}

interface GeneratedUser {
  email: string;
  password: string;
}

export default function DbTestPage() {
  const [generatedUser, setGeneratedUser] = useState<GeneratedUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Generate random email (server will generate password)
  const generateRandomUser = () => {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'test.com'];
    const randomString = Math.random().toString(36).substring(2, 8);
    const email = `user${randomString}@${domains[Math.floor(Math.random() * domains.length)]}`;
    
    setGeneratedUser({ email, password: '(Server will generate password)' });
  };

  // Add generated user to database
  const addUserToDb = async () => {
    if (!generatedUser) {
      alert('Please generate a user first');
      return;
    }

    setLoading(true);
    try {
      const apiBase = window.location.hostname === 'localhost' ? 'https://sharezidi-app10.utztjw.easypanel.host' : '';
      const response = await fetch(`${apiBase}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: generatedUser.email }),
      });

      const result = await response.json();
      
      if (response.ok) {
        // Update the displayed user with the actual server-generated password
        setGeneratedUser({ 
          email: result.user.email, 
          password: result.generatedPassword 
        });
        alert(`User added successfully!\nEmail: ${result.user.email}\nGenerated Password: ${result.generatedPassword}`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Show all users from database
  const showAllUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dbtest/users');
      
      if (response.ok) {
        const result = await response.json();
        setUsers(result.users || []);
      } else {
        const error = await response.json();
        alert(`Error fetching users: ${error.error}`);
      }
    } catch (error) {
      alert(`Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Database Test Page</CardTitle>
            <CardDescription className="text-center">
              Test PostgreSQL database connectivity and operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Control Buttons */}
            <div className="flex flex-wrap gap-4 justify-center">
              <Button 
                onClick={generateRandomUser}
                variant="outline"
                className="min-w-[200px]"
              >
                Generate Random User
              </Button>
              
              <Button 
                onClick={addUserToDb}
                disabled={!generatedUser || loading}
                className="min-w-[200px]"
              >
                {loading ? 'Adding...' : 'Add Generated User to DB'}
              </Button>
              
              <Button 
                onClick={showAllUsers}
                disabled={loading}
                variant="secondary"
                className="min-w-[200px]"
              >
                {loading ? 'Loading...' : 'Show All Users from DB'}
              </Button>
            </div>

            {/* Generated User Display */}
            {generatedUser && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="text-lg text-green-800 dark:text-green-200">
                    Generated User (Ready to Add)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 font-mono">
                    <div><strong>Email:</strong> {generatedUser.email}</div>
                    <div><strong>Password:</strong> {generatedUser.password}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users List Display */}
            {users.length > 0 && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-800 dark:text-blue-200">
                    All Users in Database ({users.length} total)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {users.map((user, index) => (
                      <div 
                        key={user.id || index} 
                        className="p-3 bg-white dark:bg-gray-800 rounded-lg border font-mono text-sm"
                      >
                        <div><strong>ID:</strong> {user.id}</div>
                        <div><strong>Email:</strong> {user.email}</div>
                        {user.password && <div><strong>Password:</strong> {user.password}</div>}
                        {user.createdAt && <div><strong>Created:</strong> {new Date(user.createdAt).toLocaleString()}</div>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {users.length === 0 && !generatedUser && (
              <Card className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">
                    Click "Generate Random User" to start testing database operations
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}