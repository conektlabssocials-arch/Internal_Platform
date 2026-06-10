import type {
  AuthProvider,
  UserDocument,
  UserRole,
  UserStatus,
} from '../models/user.model.js';

export type UserDto = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  authProvider: AuthProvider;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateUserDto = {
  name?: string;
  email?: string;
  role?: UserRole;
  authProvider?: AuthProvider;
  createdBy?: string;
};

export type UpdateUserDto = {
  name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  updatedBy?: string;
};

export const mapUserToDto = (user: UserDocument): UserDto => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  avatarUrl: user.avatarUrl ?? undefined,
  authProvider: user.authProvider || 'dev',
  lastLoginAt: user.lastLoginAt ?? undefined,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
