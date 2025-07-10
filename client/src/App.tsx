import { useState, useEffect } from "react";
import { Router, Route, Switch } from "wouter";
import { ShareZidiApp } from "./components/ShareZidiApp";
import LandingPage from "./pages/landing-page";
import LoginPage from "./pages/login-page";
import AuthPage from "./pages/auth-page";
import DbTestPage from "./pages/db-test-page";
import "./index.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
        });

        console.log("Auth check response:", response);

        if (response.ok) {
          const userData = await response.json();
          // Only set authenticated if we actually get user data
          if (userData && userData.id) {
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        // User not authenticated, show landing page
        console.log("Not authenticated, showing landing page");
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

  return (
    <Router>
      <Switch>
        {/* Landing page always at root */}
        <Route path="/">
          <LandingPage onAuthSuccess={handleAuthSuccess} />
        </Route>

        {/* Redirect /login to /auth page */}
        <Route path="/login">
          {window.location.href = "/auth"}
        </Route>

        {/* Main ShareZidi app - requires authentication */}
        <Route path="/start">
          {isAuthenticated ? (
            <ShareZidiApp />
          ) : (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
              <div className="text-center p-8 bg-white rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
                <p className="text-gray-600 mb-6">Please log in to access ShareZidi</p>
                <button 
                  onClick={() => window.location.href = "/login"}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}
        </Route>

        {/* Full authentication page */}
        <Route path="/auth">
          <AuthPage onAuthSuccess={() => {
            handleAuthSuccess();
            window.location.href = "/start";
          }} />
        </Route>

        {/* Database testing page */}
        <Route path="/dbtest">
          <DbTestPage />
        </Route>
      </Switch>
    </Router>
  );
}

export default App;
