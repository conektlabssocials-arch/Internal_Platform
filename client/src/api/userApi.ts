import { apiRequest } from './apiClient';
import type { User, UserRole } from '../types/auth';

type UsersResponse = {
  users: User[];
};

type UserResponse = {
  user: User;
};

type CreateUserInput = {
  name: string;
  email: string;
  role: UserRole;
};

export const getUsers = async () => {
  const data = await apiRequest<UsersResponse>('/users');
  return data.users;
};

export const createUser = async (input: CreateUserInput) => {
  const data = await apiRequest<UserResponse>('/users', {
    method: 'POST',
    body: input,
  });

  return data.user;
};

export const setUserActiveState = async (id: string, shouldBeActive: boolean) => {
  const data = await apiRequest<UserResponse>(`/users/${id}/${shouldBeActive ? 'activate' : 'deactivate'}`, {
    method: 'PATCH',
  });

  return data.user;
};
