import { apiRequest, SERVER_BASE_URL } from './apiClient';
import type { User } from '../types/auth';

type AuthResponse = {
  user: User;
};

export const startGoogleLogin = () => {
  window.location.assign(
    SERVER_BASE_URL
      ? `${SERVER_BASE_URL}/api/auth/google`
      : '/api/auth/google',
  );
};

export const devLoginRequest = async (email: string) => {
  const data = await apiRequest<AuthResponse>('/auth/dev-login', {
    method: 'POST',
    body: { email },
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
