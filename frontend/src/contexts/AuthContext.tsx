'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  full_name?: string;
  email?: string;
  mobile?: string;
  role?: string;
  status?: string;
  has_claimed_trial?: boolean;
  has_active_subscription?: boolean;
  subscription_expires_at?: string | null;
  subscription_plan_name?: string | null;
  subscription_plan_tier?: string | null;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, userData?: User | null) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  isReady: boolean;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  login: () => {},
  logout: () => {},
  setUser: () => {},
  isReady: false,
  refreshUser: async () => null,
});

/** Write the token to a JS-accessible cookie so the Next.js Edge middleware can
 *  verify it on every server-side navigation (without a round-trip to the API).
 *  Not httpOnly so the client can still clear it on logout.
 *  SameSite=Strict prevents CSRF from third-party sites.
 */
function setTokenCookie(token: string) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  document.cookie = `adminToken=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

function clearTokenCookie() {
  document.cookie = 'adminToken=; path=/; max-age=0; SameSite=Strict';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  const fetchProfile = async (authToken: string): Promise<User | null> => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && data?.data?.user) {
        setUser(data.data.user);
        if (data.data.user.has_claimed_trial) {
          try {
            localStorage.setItem('nivatv_trial_claimed', 'true');
          } catch (_) {}
        }
        return data.data.user;
      } else if (res.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('nivatv_trial_claimed');
        clearTokenCookie();
        setToken(null);
        setUser(null);
        return null;
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const stored = localStorage.getItem('adminToken');
      if (stored) {
        setToken(stored);
        setTokenCookie(stored);
        await fetchProfile(stored);
      }
      setIsReady(true);
    });
  }, []);

  const login = (t: string, userData?: User | null) => {
    localStorage.setItem('adminToken', t);
    setTokenCookie(t);
    setToken(t);
    if (userData) {
      setUser(userData);
      if (userData.has_claimed_trial) {
        try {
          localStorage.setItem('nivatv_trial_claimed', 'true');
        } catch (_) {}
      }
    }
    void fetchProfile(t);
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('nivatv_trial_claimed');
    clearTokenCookie();
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    if (token) {
      return await fetchProfile(token);
    }
    return null;
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, setUser, isReady, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
