import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { InventoryPhotoUploadCommandService } from './inventoryPhotoUploadCommand.service.js';
import type { IInventoryService } from './inventory.service.js';
import type { IPlatformSettingsService } from './platformSettings.service.js';
import type { IUploadService } from './upload.service.js';

const actor = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
} as const;

const inventory = {
  id: '000000000000000000000020',
  inventoryCode: 'OOH-BLR-001',
  title: 'Koramangala Hoarding',
  updatedAt: new Date('2026-06-19T09:00:00.000Z'),
  photos: ['https://res.cloudinary.com/example/existing.jpg'],
};

const pngBase64 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString('base64');

const allowAll = {
  hasPermission: async () => true,
} as unknown as IPlatformSettingsService;

const createService = ({
  inventoryService,
  uploadService,
  platformSettings = allowAll,
}: {
  inventoryService: IInventoryService;
  uploadService: IUploadService;
  platformSettings?: IPlatformSettingsService;
}) =>
  new InventoryPhotoUploadCommandService(
    inventoryService,
    uploadService,
    platformSettings,
  );

test('inventory photo upload rejects an actor without uploads.manage', async () => {
  let uploaded = false;
  const service = createService({
    inventoryService: {
      getInventoryById: async () => inventory,
    } as unknown as IInventoryService,
    uploadService: {
      uploadInventoryPhotos: async () => {
        uploaded = true;
        return [] as never;
      },
    } as unknown as IUploadService,
    platformSettings: { hasPermission: async () => false } as unknown as IPlatformSettingsService,
  });

  await assert.rejects(
    () =>
      service.uploadAndAttach(
        inventory.id,
        {
          expectedUpdatedAt: inventory.updatedAt.toISOString(),
          fileName: 'site.png',
          mimeType: 'image/png',
          base64Data: pngBase64,
        },
        actor,
      ),
    /permission/,
  );
  assert.equal(uploaded, false);
});

test('inventory photo upload rejects a stale expectedUpdatedAt', async () => {
  let uploaded = false;
  const service = createService({
    inventoryService: {
      getInventoryById: async () => inventory,
    } as unknown as IInventoryService,
    uploadService: {
      uploadInventoryPhotos: async () => {
        uploaded = true;
        return [] as never;
      },
    } as unknown as IUploadService,
  });

  await assert.rejects(
    () =>
      service.uploadAndAttach(
        inventory.id,
        {
          expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
          fileName: 'site.png',
          mimeType: 'image/png',
          base64Data: pngBase64,
        },
        actor,
      ),
    /changed since it was read/,
  );
  assert.equal(uploaded, false);
});

test('inventory photo upload forwards a Multer-shaped file and returns the refreshed item', async () => {
  let received: { inventoryId?: string; fileCount?: number; mimetype?: string } = {};
  const refreshed = { ...inventory, photos: [...inventory.photos, 'https://x/new.png'] };
  let calls = 0;
  const service = createService({
    inventoryService: {
      getInventoryById: async () => {
        calls += 1;
        return calls === 1 ? inventory : refreshed;
      },
    } as unknown as IInventoryService,
    uploadService: {
      uploadInventoryPhotos: async (inventoryId: string, files: { mimetype: string }[]) => {
        received = { inventoryId, fileCount: files.length, mimetype: files[0]?.mimetype };
        return [{ id: 'u1', url: '/api/uploads/u1/download' }] as never;
      },
    } as unknown as IUploadService,
  });

  const result = await service.uploadAndAttach(
    inventory.id,
    {
      expectedUpdatedAt: inventory.updatedAt.toISOString(),
      fileName: 'site.png',
      mimeType: 'image/png',
      base64Data: pngBase64,
    },
    actor,
  );

  assert.deepEqual(received, {
    inventoryId: inventory.id,
    fileCount: 1,
    mimetype: 'image/png',
  });
  assert.equal(result.uploads.length, 1);
  assert.deepEqual(result.inventory, refreshed);
});

test('inventory photo upload rejects an oversized payload before uploading', async () => {
  let uploaded = false;
  process.env.MCP_MAX_UPLOAD_BYTES = '10';
  try {
    const service = createService({
      inventoryService: {
        getInventoryById: async () => inventory,
      } as unknown as IInventoryService,
      uploadService: {
        uploadInventoryPhotos: async () => {
          uploaded = true;
          return [] as never;
        },
      } as unknown as IUploadService,
    });

    await assert.rejects(
      () =>
        service.uploadAndAttach(
          inventory.id,
          {
            expectedUpdatedAt: inventory.updatedAt.toISOString(),
            fileName: 'site.png',
            mimeType: 'image/png',
            base64Data: Buffer.alloc(64, 1).toString('base64'),
          },
          actor,
        ),
      /exceeds the 10 byte MCP limit/,
    );
  } finally {
    delete process.env.MCP_MAX_UPLOAD_BYTES;
  }
  assert.equal(uploaded, false);
});
