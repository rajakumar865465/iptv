'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  login: () => {},
  logout: () => {},
  isReady: false,
});

/** Write the token to a JS-accessible cookie so the Next.js Edge middleware can
 *  verify it on every server-side navigation (without a round-trip to the API).
 *  Not httpOnly so the client can still clear it on logout.
 *  SameSite=Strict prevents CSRF from third-party sites.
 */
function setTokenCookie(token: string) {
  const maxAge = 60 * 60 * 24; // 1 day — matches ADMIN_JWT_SECRET expiry
  document.cookie = `adminToken=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

function clearTokenCookie() {
  document.cookie = 'adminToken=; path=/; max-age=0; SameSite=Strict';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('adminToken');
    if (stored) {
      setToken(stored);
      setTokenCookie(stored); // sync cookie with stored token on page load
    }
    setIsReady(true);
  }, []);

  const login = (t: string) => {
    localStorage.setItem('adminToken', t);
    setTokenCookie(t);
    setToken(t);
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    clearTokenCookie();
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
