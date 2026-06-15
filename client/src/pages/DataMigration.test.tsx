import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import DataMigration from './DataMigration';

const api = vi.hoisted(() => ({
  getImportTemplates: vi.fn(),
  getImportJobs: vi.fn(),
  uploadImportFile: vi.fn(),
}));

vi.mock('../api/importApi', () => ({
  getImportTemplates: api.getImportTemplates,
  getImportJobs: api.getImportJobs,
  uploadImportFile: api.uploadImportFile,
  validateImportJob: vi.fn(),
  commitImportJob: vi.fn(),
  getImportJob: vi.fn(),
  downloadImportTemplate: vi.fn(),
  downloadImportErrors: vi.fn(),
  deleteImportJob: vi.fn(),
}));

describe('Bulk Data Upload modal', () => {
  it('stays open after selecting and uploading a CSV', async () => {
    api.getImportTemplates.mockResolvedValue([
      {
        name: 'inventory_outdoor',
        fileName: 'inventory_outdoor_template.csv',
        importType: 'inventory',
        description: 'Outdoor inventory',
      },
    ]);
    api.getImportJobs.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 15, total: 0, totalPages: 1 },
    });
    api.uploadImportFile.mockResolvedValue({
      id: 'job-1',
      importType: 'inventory',
      status: 'uploaded',
      originalName: 'inventory.csv',
      totalRows: 1,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      importedRows: 0,
      skippedRows: 0,
      warnings: 0,
      previewRows: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const onClose = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <DataMigration onClose={onClose} />
      </MemoryRouter>,
    );
    await screen.findByText('Inventory Outdoor');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['categoryGroup,title\nOutdoor,Test'], 'inventory.csv', {
      type: 'text/csv',
    });
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload and Parse' }));

    await waitFor(() => expect(api.uploadImportFile).toHaveBeenCalledWith('inventory', file));
    expect(screen.getByRole('heading', { name: 'Bulk Data Upload' })).toBeInTheDocument();
    expect(screen.getByText(/was parsed/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
