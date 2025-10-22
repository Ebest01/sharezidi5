import { useState, useEffect } from 'react';

interface User {
  id: number;
  email: string;
  username?: string;
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
      const apiBase = window.location.hostname === 'localhost' ? 'https://sharezidi-app10.utztjw.easypanel.host' : '';
      const response = await fetch(`${apiBase}/api/auth/user`, {
        credentials: 'include'
      });
      
      console.log('Auth check response:', response.status, response.ok);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('Received user data:', userData);
        setUser(userData);
      } else {
        console.log('Auth check failed, checking localStorage');
        // Fallback to localStorage for guest users
        const savedUser = localStorage.getItem('shareZidiUser');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            console.log('Using localStorage user:', parsedUser);
            setUser(parsedUser);
          } catch (error) {
            localStorage.removeItem('shareZidiUser');
          }
        } else {
          console.log('No user found in localStorage');
        }
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      // Fallback to localStorage
      const savedUser = localStorage.getItem('shareZidiUser');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          console.log('Using localStorage user (after error):', parsedUser);
          setUser(parsedUser);
        } catch (error) {
          localStorage.removeItem('shareZidiUser');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData: User) => {
    console.log('useAuth.login called with:', userData);
    setUser(userData);
    localStorage.setItem('shareZidiUser', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      const apiBase = window.location.hostname === 'localhost' ? 'https://sharezidi-app10.utztjw.easypanel.host' : '';
      await fetch(`${apiBase}/api/auth/logout`, {
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