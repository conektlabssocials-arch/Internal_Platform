import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { getMeRequest, loginWithGoogleRequest, logoutRequest } from '../api/authApi';
import type { User } from '../types/auth';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refetchUser = async () => {
    try {
      const currentUser = await getMeRequest();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      await refetchUser();
      setLoading(false);
    };

    loadUser();
  }, []);

  const loginWithGoogle = async (credential: string) => {
    const nextUser = await loginWithGoogleRequest(credential);
    setUser(nextUser);
  };

  const logout = async () => {
    await logoutRequest();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      loginWithGoogle,
      logout,
      refetchUser,
      isAdmin: user?.role === 'admin',
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
