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
  subscription_plan_id?: number | null;
  subscription_plan_price?: number | null;
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
const USER_CACHE_KEY = 'nivatv_user_cache';

function setTokenCookie(token: string) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  document.cookie = `adminToken=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

function clearTokenCookie() {
  document.cookie = 'adminToken=; path=/; max-age=0; SameSite=Strict';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  // Helper to keep localStorage cache synchronized with React state
  const setUser = (userData: User | null) => {
    setUserState(userData);
    if (typeof window !== 'undefined') {
      try {
        if (userData) {
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
        } else {
          localStorage.removeItem(USER_CACHE_KEY);
        }
      } catch (_) {}
    }
  };

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
        localStorage.removeItem(USER_CACHE_KEY);
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

  // Instant client rehydration from local storage: eliminates login state flicker/buffer on page loads
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('adminToken');
      const cachedUserStr = localStorage.getItem(USER_CACHE_KEY);

      if (storedToken) {
        setToken(storedToken);
        setTokenCookie(storedToken);

        if (cachedUserStr) {
          try {
            const parsed = JSON.parse(cachedUserStr);
            setUserState(parsed);
          } catch (_) {}
        }
      }
    } catch (_) {}

    // Mark ready immediately from cache so UI renders with the user already logged in!
    setIsReady(true);

    // Silently revalidate profile with backend in background (stale-while-revalidate)
    const stored = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    if (stored) {
      void fetchProfile(stored);
    }
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
    localStorage.removeItem(USER_CACHE_KEY);
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
