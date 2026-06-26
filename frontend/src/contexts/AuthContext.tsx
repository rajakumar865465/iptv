'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType>({ token: null, login: () => {}, logout: () => {}, isReady: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('adminToken');
    if (stored) setToken(stored);
    setIsReady(true);
  }, []);

  const login = (t: string) => {
    localStorage.setItem('adminToken', t);
    setToken(t);
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
