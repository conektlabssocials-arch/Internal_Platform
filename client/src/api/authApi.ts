import { apiRequest } from './apiClient';
import type { User } from '../types/auth';

type AuthResponse = {
  user: User;
};

export const loginWithGoogleRequest = async (credential: string) => {
  const data = await apiRequest<AuthResponse>('/auth/google', {
    method: 'POST',
    body: { credential },
  });

  return data.user;
};

export const logoutRequest = async () => {
  await apiRequest<{ success: boolean }>('/auth/logout', {
    method: 'POST',
  });
};

export const getMeRequest = async () => {
  const data = await apiRequest<AuthResponse>('/auth/me');
  return data.user;
};
