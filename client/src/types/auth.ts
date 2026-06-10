export type UserRole = 'admin' | 'member';
export type UserStatus = 'active' | 'inactive';
export type AuthProvider = 'google' | 'dev';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  authProvider: AuthProvider;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
};
