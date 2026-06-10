import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import {
  devLoginRequest,
  getMeRequest,
  logoutRequest,
  startGoogleLogin,
} from '../api/authApi';
import { AUTH_UNAUTHORIZED_EVENT } from '../api/apiClient';
import type { User } from '../types/auth';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  authError: string;
  loginWithGoogle: () => void;
  devLogin: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const refetchUser = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const currentUser = await getMeRequest();
      setUser(currentUser);
      setAuthError('');
    } catch (error) {
      setUser(null);
      const message = error instanceof Error ? error.message : '';
      setAuthError(message.toLowerCase().includes('inactive') ? message : '');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      await refetchUser();
      setLoading(false);
    };
    void loadUser();
  }, []);

  useEffect(() => {
    const revalidateSession = () => {
      void refetchUser(true);
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) revalidateSession();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') revalidateSession();
    };
    const handleUnauthorized = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message || '';
      setUser(null);
      setAuthError(message.toLowerCase().includes('inactive') ? message : '');
      setLoading(false);
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', revalidateSession);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', revalidateSession);
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const loginWithGoogle = () => startGoogleLogin();

  const devLogin = async (email: string) => {
    const nextUser = await devLoginRequest(email);
    setUser(nextUser);
    setAuthError('');
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setAuthError('');
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      loginWithGoogle,
      devLogin,
      logout,
      refetchUser,
      isAdmin: user?.role === 'admin',
    }),
    [user, loading, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
