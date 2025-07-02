import { useState, useEffect } from "react";
import { ShareZidiApp } from "./components/ShareZidiApp";
import LandingPage from "./pages/landing-page";
import "./index.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include'
        });
        if (response.ok) {
          const userData = await response.json();
          // Only set authenticated if we actually get user data
          if (userData && userData.id) {
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        // User not authenticated, show landing page
        console.log('Not authenticated, showing landing page');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading ShareZidi...</p>
        </div>
      </div>
    );
  }

  // Force landing page for non-authenticated users
  if (!isAuthenticated) {
    return <LandingPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Only show main app if explicitly authenticated
  return <ShareZidiApp />;
}

export default App;
