import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PublicSharedPlan from './PublicSharedPlan';
import { getPublicShare } from '../api/shareApi';

vi.mock('../api/shareApi', async () => {
  class PublicShareError extends Error {
    constructor(
      message: string,
      public readonly status: number,
    ) {
      super(message);
    }
  }

  return {
    PublicShareError,
    getPublicShare: vi.fn(),
  };
});

vi.mock('../components/maps/SharedPlanMap', () => ({
  default: () => <div>Client-safe map</div>,
}));

vi.mock('../components/maps/NonMapInventoryList', () => ({
  default: () => <div>Transit inventory</div>,
}));

describe('PublicSharedPlan', () => {
  it('renders client-safe plan data without internal pricing fields', async () => {
    vi.mocked(getPublicShare).mockResolvedValue({
      share: { status: 'active', viewCount: 1 },
      campaign: {
        title: 'Bangalore Launch',
        clientName: 'Example Brand',
        brief: 'Outdoor launch campaign.',
      },
      plan: {
        versionLabel: 'v1',
        status: 'Shared',
        clientNotes: 'Rates are valid for seven days.',
        items: [{
          title: 'Koramangala Hoarding',
          categoryGroup: 'Outdoor',
          subCategory: 'Hoarding',
          city: 'Bangalore',
          area: 'Koramangala',
          quantity: 1,
          unitSellingPrice: 500000,
          totalSellingPrice: 500000,
        }],
        pricing: {
          subtotal: 500000,
          taxPercentage: 18,
          taxAmount: 90000,
          grandTotal: 590000,
        },
      },
      mapItems: [],
      nonMapItems: [],
    });

    render(
      <MemoryRouter initialEntries={['/share/plan/client-safe-token']}>
        <Routes>
          <Route path="/share/plan/:token" element={<PublicSharedPlan />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Bangalore Launch')).toBeInTheDocument();
    expect(screen.getAllByText('Koramangala Hoarding')).not.toHaveLength(0);
    expect(screen.getByText('This shared plan is read-only.')).toBeInTheDocument();
    expect(screen.queryByText(/internal cost/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/margin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/supplier/i)).not.toBeInTheDocument();
  });
});
