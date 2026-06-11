import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import FileUploadDropzone from './FileUploadDropzone';

describe('FileUploadDropzone', () => {
  it('shows selected files and uploads supported content', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <FileUploadDropzone
        accept={['image/png']}
        maxFiles={2}
        maxFileSizeMb={1}
        onUpload={onUpload}
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['png'], 'proof.png', { type: 'image/png' });

    await userEvent.upload(input, file);
    expect(screen.getByText('proof.png')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Upload 1 file' }));
    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it('shows a readable error for unsupported files', async () => {
    const { container } = render(
      <FileUploadDropzone
        accept={['image/png']}
        maxFiles={1}
        maxFileSizeMb={1}
        onUpload={vi.fn()}
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(
      input,
      new File(['bad'], 'script.exe', { type: 'application/x-msdownload' }),
      { applyAccept: false },
    );
    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
  });
});
