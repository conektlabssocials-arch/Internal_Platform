import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import InventoryCategoryCard from './InventoryCategoryCard';

describe('InventoryCategoryCard', () => {
  it('renders health counts and opens the category', async () => {
    const onClick = vi.fn();
    render(
      <InventoryCategoryCard
        categoryGroup="Outdoor"
        total={20}
        available={12}
        stale={3}
        neverConfirmed={5}
        description="Fixed outdoor inventory"
        onClick={onClick}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Outdoor' })).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'View Inventory' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
