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
    // Check for existing user session
    const savedUser = localStorage.getItem('shareZidiUser');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        localStorage.removeItem('shareZidiUser');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('shareZidiUser', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('shareZidiUser');
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