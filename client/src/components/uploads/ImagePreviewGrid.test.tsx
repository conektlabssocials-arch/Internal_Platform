import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import ImagePreviewGrid from './ImagePreviewGrid';

describe('ImagePreviewGrid', () => {
  it('shows the default image when no inventory photos exist', () => {
    render(<ImagePreviewGrid />);

    expect(
      screen.getByRole('img', { name: 'No inventory image available' }),
    ).toHaveAttribute('src', '/no-inventory-image.svg');
  });

  it('opens an image inside a modal and closes it without navigating away', async () => {
    const user = userEvent.setup();
    render(
      <ImagePreviewGrid
        legacyUrls={['https://example.com/inventory-photo.jpg']}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Preview Uploaded image' }));

    expect(
      screen.getByRole('dialog', { name: 'Preview Uploaded image' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close image preview' }));

    expect(
      screen.queryByRole('dialog', { name: 'Preview Uploaded image' }),
    ).not.toBeInTheDocument();
  });
});
