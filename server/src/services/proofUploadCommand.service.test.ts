import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { IOperationCommandService } from './operationCommand.service.js';
import type { IOperationService } from './operation.service.js';
import { ProofUploadCommandService } from './proofUploadCommand.service.js';
import type { IUploadService } from './upload.service.js';

const actor = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
} as const;

const operation = {
  id: '000000000000000000000010',
  operationCode: 'OPS-2026-0001',
  updatedAt: new Date('2026-06-10T09:00:00.000Z'),
  items: [
    {
      id: '000000000000000000000040',
      proof: {
        photoUrls: ['https://example.com/existing.jpg'],
        notes: 'Existing note',
      },
    },
  ],
};

const pngBase64 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString('base64');

test('proof upload rejects bytes that do not match the declared image type', async () => {
  let uploaded = false;
  const service = new ProofUploadCommandService(
    { getById: async () => operation } as unknown as IOperationService,
    {} as IOperationCommandService,
    {
      uploadImage: async () => {
        uploaded = true;
        return {} as never;
      },
    } as IUploadService,
  );

  await assert.rejects(
    () =>
      service.uploadAndAttach(
        operation.id,
        operation.items[0].id,
        {
          expectedUpdatedAt: operation.updatedAt.toISOString(),
          fileName: 'proof.png',
          mimeType: 'image/png',
          base64Data: Buffer.from('not a png').toString('base64'),
        },
        actor,
      ),
    /does not match mimeType/,
  );
  assert.equal(uploaded, false);
});

test('proof upload appends the URL and attaches it through the audited command', async () => {
  let attachment: Record<string, unknown> | undefined;
  const upload = {
    url: 'https://res.cloudinary.com/example/proof.png',
    publicId: 'operations/OPS-2026-0001/proof/proof',
  };
  const service = new ProofUploadCommandService(
    { getById: async () => operation } as unknown as IOperationService,
    {
      updateItem: async (
        operationId,
        itemId,
        kind,
        input,
        receivedActor,
      ) => {
        attachment = { operationId, itemId, kind, input, actor: receivedActor };
        return { ...operation, updatedAt: new Date() } as never;
      },
    } as IOperationCommandService,
    {
      uploadImage: async () => upload,
      deleteImage: async () => undefined,
    } as IUploadService,
  );

  const result = await service.uploadAndAttach(
    operation.id,
    operation.items[0].id,
    {
      expectedUpdatedAt: operation.updatedAt.toISOString(),
      fileName: 'proof.png',
      mimeType: 'image/png',
      base64Data: pngBase64,
      notes: 'Mounted view',
    },
    actor,
  );

  assert.deepEqual(result.upload, upload);
  assert.deepEqual(attachment, {
    operationId: operation.id,
    itemId: operation.items[0].id,
    kind: 'proof',
    input: {
      expectedUpdatedAt: operation.updatedAt.toISOString(),
      mutation: {
        uploaded: true,
        photoUrls: [
          'https://example.com/existing.jpg',
          'https://res.cloudinary.com/example/proof.png',
        ],
        notes: 'Mounted view',
      },
    },
    actor,
  });
});

test('proof upload removes the Cloudinary asset if attachment fails', async () => {
  let deletedPublicId: string | undefined;
  const upload = {
    url: 'https://res.cloudinary.com/example/proof.png',
    publicId: 'operations/OPS-2026-0001/proof/proof',
  };
  const service = new ProofUploadCommandService(
    { getById: async () => operation } as unknown as IOperationService,
    {
      updateItem: async () => {
        throw new Error('stale operation');
      },
    } as unknown as IOperationCommandService,
    {
      uploadImage: async () => upload,
      deleteImage: async (publicId) => {
        deletedPublicId = publicId;
      },
    } as IUploadService,
  );

  await assert.rejects(
    () =>
      service.uploadAndAttach(
        operation.id,
        operation.items[0].id,
        {
          expectedUpdatedAt: operation.updatedAt.toISOString(),
          fileName: 'proof.png',
          mimeType: 'image/png',
          base64Data: pngBase64,
        },
        actor,
      ),
    /stale operation/,
  );
  assert.equal(deletedPublicId, upload.publicId);
});
