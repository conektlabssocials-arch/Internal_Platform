import type { UserRole } from '../models/user.model.js';

export type AuthTokenPayload = {
  userId: string;
  email: string;
  role: UserRole;
};
