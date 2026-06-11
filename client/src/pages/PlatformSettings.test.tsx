import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PlatformSettings from './PlatformSettings';
import {
  getPlatformSettings,
  updatePlatformSettings,
} from '../api/platformSettingsApi';

vi.mock('../api/platformSettingsApi', () => ({
  getPlatformSettings: vi.fn(),
  updatePlatformSettings: vi.fn(),
}));

const permissions = {
  'inventory.create': false,
  'inventory.edit': true,
  'inventory.confirm': true,
  'crm.manage': true,
  'campaigns.manage': true,
  'plans.manage': true,
  'operations.manage': true,
  'documents.generate': true,
  'shares.manage': true,
  'uploads.manage': true,
};

describe('PlatformSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatformSettings).mockResolvedValue({ memberPermissions: permissions });
    vi.mocked(updatePlatformSettings).mockResolvedValue({
      memberPermissions: { ...permissions, 'inventory.create': true },
    });
  });

  it('allows Admin to enable Member inventory creation and save it', async () => {
    const user = userEvent.setup();
    render(<PlatformSettings />);

    const addInventory = await screen.findByRole('checkbox', { name: /add inventory/i });
    expect(addInventory).not.toBeChecked();

    await user.click(addInventory);
    await user.click(screen.getByRole('button', { name: 'Save Permissions' }));

    expect(updatePlatformSettings).toHaveBeenCalledWith(
      expect.objectContaining({ 'inventory.create': true }),
    );
    expect(await screen.findByText('Member permissions were updated.')).toBeInTheDocument();
  });
});
