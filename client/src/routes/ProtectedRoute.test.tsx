import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProtectedRoute from './ProtectedRoute';

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; email: string; role: 'admin' | 'member' },
  loading: false,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    ...authState,
    authError: '',
    isAdmin: authState.user?.role === 'admin',
  }),
}));

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={['/private']}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <p>Private content</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
  });

  it('redirects unauthenticated users', () => {
    renderRoute();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('keeps authenticated content mounted', () => {
    authState.user = {
      id: '1',
      name: 'Ajmal',
      email: 'ajmal@conektads.com',
      role: 'admin',
    };
    renderRoute();
    expect(screen.getByText('Private content')).toBeInTheDocument();
  });
});
