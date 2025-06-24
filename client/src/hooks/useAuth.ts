import { useState, useEffect } from 'react';

interface User {
  id: number;
  email: string;
  transferCount: number;
  isPro: boolean;
  isGuest?: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check URL for auth success/failure
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('auth');
    const authError = urlParams.get('error');

    if (authResult === 'success') {
      // Google auth success - fetch user from backend
      fetchCurrentUser();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authError) {
      console.error('Auth error:', authError);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check for existing session or local storage
      fetchCurrentUser();
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Fallback to localStorage for guest users
        const savedUser = localStorage.getItem('shareZidiUser');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (error) {
            localStorage.removeItem('shareZidiUser');
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      // Fallback to localStorage
      const savedUser = localStorage.getItem('shareZidiUser');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          localStorage.removeItem('shareZidiUser');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('shareZidiUser', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('shareZidiUser');
    }
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('shareZidiUser', JSON.stringify(updatedUser));
    }
  };

  const incrementTransferCount = () => {
    if (user && !user.isPro) {
      updateUser({ transferCount: (user.transferCount || 0) + 1 });
    }
  };

  const canTransfer = () => {
    if (!user) return false;
    if (user.isPro) return true;
    return (user.transferCount || 0) < 15;
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
    incrementTransferCount,
    canTransfer
  };
};