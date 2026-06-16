import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ICrmService } from './crm.service.js';
import type { IGoogleDrivePhotoService } from './googleDrivePhoto.service.js';
import { ImportProcessorService } from './importProcessor.service.js';
import type { IInventoryService } from './inventory.service.js';

const baseInventoryRow = {
  rowNumber: 2,
  status: 'valid' as const,
  data: {
    categoryGroup: 'A3 Screens',
    subCategory: 'Residential',
    title: 'Mumbai Tower Screens',
    city: 'Mumbai',
    area: 'Bandra',
    availabilityStatus: 'unknown',
    propertyVisualLink: 'https://drive.google.com/drive/folders/FOLDER_ID',
  },
};

test('inventory import saves Drive image URLs into photos', async () => {
  const created: unknown[] = [];
  const processor = new ImportProcessorService(
    { createInventory: async (input: unknown) => created.push(input) } as IInventoryService,
    {} as ICrmService,
    {
      extractDriveFolderId: () => 'FOLDER_ID',
      getImagesFromDriveFolder: async () => ({
        photos: [
          'https://drive.google.com/uc?id=FILE_1',
          'https://drive.google.com/uc?id=FILE_2',
        ],
      }),
    } as IGoogleDrivePhotoService,
  );

  const result = await processor.process('inventory', [baseInventoryRow], 'actor-id');

  assert.equal(result.importedRows, 1);
  assert.deepEqual((created[0] as { photos: string[] }).photos, [
    'https://drive.google.com/uc?id=FILE_1',
    'https://drive.google.com/uc?id=FILE_2',
  ]);
  assert.equal(result.drivePhotoImport?.totalFoldersProcessed, 1);
  assert.equal(result.drivePhotoImport?.totalPhotosExtracted, 2);
  assert.equal(result.drivePhotoImport?.failedFolderCount, 0);
});

test('inventory import continues and records row error when Drive lookup fails', async () => {
  const created: unknown[] = [];
  const processor = new ImportProcessorService(
    { createInventory: async (input: unknown) => created.push(input) } as IInventoryService,
    {} as ICrmService,
    {
      extractDriveFolderId: () => 'FOLDER_ID',
      getImagesFromDriveFolder: async () => ({
        photos: [],
        error: 'Google Drive API request failed',
      }),
    } as IGoogleDrivePhotoService,
  );

  const result = await processor.process('inventory', [baseInventoryRow], 'actor-id');

  assert.equal(result.importedRows, 1);
  assert.equal(result.skippedRows, 0);
  assert.deepEqual((created[0] as { photos: string[] }).photos, []);
  assert.equal(result.rows[0].status, 'imported');
  assert.equal(result.rows[0].errors?.[0].field, 'propertyVisualLink');
  assert.equal(result.drivePhotoImport?.failedFolderCount, 1);
  assert.deepEqual(result.drivePhotoImport?.failedRows, [
    {
      rowNumber: 2,
      title: 'Mumbai Tower Screens',
      folderId: 'FOLDER_ID',
      reason: 'Google Drive API request failed',
    },
  ]);
});
