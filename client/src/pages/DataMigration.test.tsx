import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import DataMigration from './DataMigration';

const api = vi.hoisted(() => ({
  getImportTemplates: vi.fn(),
  getImportJobs: vi.fn(),
  uploadImportFile: vi.fn(),
  validateImportJob: vi.fn(),
}));

vi.mock('../api/importApi', () => ({
  getImportTemplates: api.getImportTemplates,
  getImportJobs: api.getImportJobs,
  uploadImportFile: api.uploadImportFile,
  validateImportJob: api.validateImportJob,
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

  it('lists every validation error after validating', async () => {
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
      totalRows: 2,
      validRows: 0,
      invalidRows: 2,
      duplicateRows: 0,
      importedRows: 0,
      skippedRows: 0,
      warnings: 0,
      previewRows: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const errors = [
      { rowNumber: 2, field: 'area', message: 'area is required' },
      { rowNumber: 2, field: 'address', message: 'address is required' },
      { rowNumber: 7, field: 'latitude', message: 'latitude is required' },
    ];
    api.validateImportJob.mockResolvedValue({
      job: {
        id: 'job-1',
        importType: 'inventory',
        status: 'validated',
        originalName: 'inventory.csv',
        totalRows: 2,
        validRows: 0,
        invalidRows: 2,
        duplicateRows: 0,
        importedRows: 0,
        skippedRows: 0,
        warnings: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      summary: {},
      previewRows: [
        { rowNumber: 2, status: 'invalid', data: { title: 'Site A' }, errors: errors.slice(0, 2) },
      ],
      errors,
      warnings: [],
    });

    const { container } = render(
      <MemoryRouter>
        <DataMigration onClose={vi.fn()} />
      </MemoryRouter>,
    );
    await screen.findByText('Inventory Outdoor');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['categoryGroup,title\nOutdoor,Test'], 'inventory.csv', { type: 'text/csv' });
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload and Parse' }));
    await screen.findByText(/was parsed/i);

    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));

    // Summary count and every individual message are visible, including the
    // error on row 7 which is not part of the 20-row preview table.
    expect(await screen.findByText('3 errors across 2 rows')).toBeInTheDocument();
    expect(screen.getAllByText('area is required').length).toBeGreaterThan(0);
    expect(screen.getAllByText('address is required').length).toBeGreaterThan(0);
    expect(screen.getByText('latitude is required')).toBeInTheDocument();
    expect(screen.getByText('Row 7')).toBeInTheDocument();
  });
});
