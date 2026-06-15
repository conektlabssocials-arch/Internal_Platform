import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import {
  devLoginRequest,
  getMeRequest,
  logoutRequest,
  startGoogleLogin,
} from '../api/authApi';
import { AUTH_UNAUTHORIZED_EVENT } from '../api/apiClient';
import { getEffectiveAccess } from '../api/platformSettingsApi';
import type { User } from '../types/auth';
import type { MemberPermission } from '../types/platformSettings';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  authError: string;
  loginWithGoogle: () => void;
  devLogin: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
  isAdmin: boolean;
  permissions: Record<MemberPermission, boolean>;
  can: (permission: MemberPermission) => boolean;
};

const permissionKeys: MemberPermission[] = [
  'inventory.create', 'inventory.edit', 'inventory.confirm', 'crm.manage',
  'campaigns.manage', 'plans.manage', 'operations.manage',
  'documents.generate', 'shares.manage', 'uploads.manage',
];
const noPermissions = Object.fromEntries(
  permissionKeys.map((permission) => [permission, false]),
) as Record<MemberPermission, boolean>;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [permissions, setPermissions] = useState(noPermissions);

  const loadPermissions = async (currentUser: User) => {
    if (currentUser.role === 'admin') {
      setPermissions(Object.fromEntries(permissionKeys.map((permission) => [permission, true])) as Record<MemberPermission, boolean>);
      return;
    }
    try {
      setPermissions((await getEffectiveAccess()).permissions);
    } catch {
      setPermissions(noPermissions);
    }
  };

  const refetchUser = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const currentUser = await getMeRequest();
      setUser(currentUser);
      await loadPermissions(currentUser);
      setAuthError('');
    } catch (error) {
      setUser(null);
      setPermissions(noPermissions);
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
      // File pickers and browser tab changes trigger focus/visibility events.
      // Revalidate in the background so open modals and unsaved forms stay mounted.
      void refetchUser(false);
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
    await loadPermissions(nextUser);
    setAuthError('');
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setPermissions(noPermissions);
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
      permissions,
      can: (permission: MemberPermission) => user?.role === 'admin' || permissions[permission],
    }),
    [user, loading, authError, permissions],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
