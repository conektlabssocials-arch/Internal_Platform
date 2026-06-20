import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';

import { validateUploadRequestTotal } from '../middleware/upload.middleware.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IOperationRepository } from '../repositories/operation.repository.js';
import type { IUploadRepository } from '../repositories/upload.repository.js';
import type { IActivityService } from './activity.service.js';
import {
  UploadService,
  validateUploadFiles,
} from './upload.service.js';
import type { IUploadStorageService } from './uploadStorage.service.js';

const actor = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  role: 'admin',
} as const;

const file = (
  mimetype: string,
  buffer: Buffer,
  originalname = 'file',
): Express.Multer.File =>
  ({
    mimetype,
    buffer,
    originalname,
    size: buffer.length,
  }) as Express.Multer.File;

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

test('upload validation accepts matching images and rejects unsupported or disguised files', () => {
  assert.doesNotThrow(() =>
    validateUploadFiles('inventory_photo', [file('image/png', png, 'site.png')]),
  );
  assert.throws(
    () => validateUploadFiles('inventory_photo', [file('application/x-msdownload', Buffer.from('MZ'), 'app.exe')]),
    /not supported/,
  );
  assert.throws(
    () => validateUploadFiles('proof', [file('image/png', Buffer.from('not png'), 'fake.png')]),
    /does not match/,
  );
});

test('upload validation accepts a valid image whose extension/MIME is wrong and corrects the type', () => {
  const mislabeled = file('image/jpeg', png, 'AM_logo.jpg');
  assert.doesNotThrow(() => validateUploadFiles('inventory_photo', [mislabeled]));
  // The declared image/jpeg is corrected to the real detected type.
  assert.equal(mislabeled.mimetype, 'image/png');
});

test('upload validation enforces category file size and request aggregate size', () => {
  const oversized = file(
    'image/jpeg',
    Buffer.alloc(10 * 1024 * 1024 + 1, 0xff),
    'large.jpg',
  );
  assert.throws(
    () => validateUploadFiles('inventory_photo', [oversized]),
    /10 MB limit/,
  );
  assert.throws(
    () =>
      validateUploadRequestTotal([
        { size: 30 * 1024 * 1024 },
        { size: 21 * 1024 * 1024 },
      ]),
    /50 MB/,
  );
});

test('public upload access rejects private files', async () => {
  const privateUpload = {
    _id: new Types.ObjectId('000000000000000000000011'),
    originalName: 'creative.pdf',
    fileName: 'creative.pdf',
    mimeType: 'application/pdf',
    size: 100,
    storageKey: 'creative/private',
    storageResourceType: 'raw',
    storageDeliveryType: 'authenticated',
    category: 'creative',
    entityType: 'OperationItem',
    uploadedBy: new Types.ObjectId(actor.userId),
    isPublicSafe: false,
    status: 'active',
    metadata: {},
  };
  const service = new UploadService(
    { findActiveById: async () => privateUpload } as unknown as IUploadRepository,
    {} as IUploadStorageService,
    {} as IInventoryRepository,
    {} as IOperationRepository,
    {} as IActivityService,
  );

  await assert.rejects(() => service.getPublicDownload(privateUpload._id.toString()), /Upload not found/);
});

test('public upload access returns active public-safe provider URLs', async () => {
  const publicUpload = {
    _id: new Types.ObjectId('000000000000000000000013'),
    originalName: 'proof.png',
    fileName: 'proof.png',
    mimeType: 'image/png',
    size: 100,
    storageKey: 'proof/public',
    storageResourceType: 'image',
    storageDeliveryType: 'upload',
    category: 'proof',
    entityType: 'OperationItem',
    uploadedBy: new Types.ObjectId(actor.userId),
    isPublicSafe: true,
    status: 'active',
    url: 'https://res.cloudinary.com/demo/image/upload/proof.png',
    metadata: {},
  };
  const service = new UploadService(
    { findActiveById: async () => publicUpload } as unknown as IUploadRepository,
    {} as IUploadStorageService,
    {} as IInventoryRepository,
    {} as IOperationRepository,
    {} as IActivityService,
  );

  assert.deepEqual(
    await service.getPublicDownload(publicUpload._id.toString()),
    { url: publicUpload.url, fileName: publicUpload.originalName },
  );
});

test('failed inventory attachment removes Cloudinary assets and upload records', async () => {
  const uploadId = new Types.ObjectId('000000000000000000000012');
  let storageDeleted = 0;
  let recordDeleted = 0;
  const inventory = {
    _id: new Types.ObjectId('000000000000000000000020'),
    inventoryCode: 'OOH-BLR-KOR-0001',
    title: 'Koramangala Hoarding',
    photos: [],
    photoUploads: [],
  };
  const service = new UploadService(
    {
      create: async (data: any) => ({
        _id: uploadId,
        ...data,
      }),
      hardDelete: async () => {
        recordDeleted += 1;
      },
    } as unknown as IUploadRepository,
    {
      upload: async () => ({
        publicId: 'inventory/site',
        secureUrl: 'https://res.cloudinary.com/demo/site.png',
        resourceType: 'image',
        deliveryType: 'upload',
        format: 'png',
        bytes: png.length,
        fileName: 'site.png',
      }),
      delete: async () => {
        storageDeleted += 1;
      },
    } as IUploadStorageService,
    {
      findById: async () => inventory,
      save: async () => {
        throw new Error('database write failed');
      },
    } as unknown as IInventoryRepository,
    {} as IOperationRepository,
    { logEntityActivity: async () => undefined } as IActivityService,
  );

  await assert.rejects(
    () =>
      service.uploadInventoryPhotos(
        inventory._id.toString(),
        [file('image/png', png, 'site.png')],
        actor,
      ),
    /database write failed/,
  );
  assert.equal(storageDeleted, 1);
  assert.equal(recordDeleted, 1);
});
