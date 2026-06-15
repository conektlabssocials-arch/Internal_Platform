import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Dashboard from './Dashboard';
import { getActivities } from '../api/activityApi';
import { getDashboardOverview } from '../api/dashboardApi';

vi.mock('../api/dashboardApi', () => ({
  getDashboardOverview: vi.fn(),
}));

vi.mock('../api/activityApi', () => ({
  getActivities: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Ajmal', email: 'ajmal@conektads.com', role: 'admin' },
  }),
}));

const mockedOverview = vi.mocked(getDashboardOverview);
const mockedActivities = vi.mocked(getActivities);

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows its loading state while dashboard requests are pending', () => {
    mockedOverview.mockReturnValue(new Promise(() => {}));
    mockedActivities.mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows a retryable error when the overview cannot be loaded', async () => {
    mockedOverview.mockRejectedValue(new Error('Network unavailable'));
    mockedActivities.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Dashboard could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Network unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
