import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { GoogleDrivePhotoService } from './googleDrivePhoto.service.js';

test('extractDriveFolderId reads Google Drive folder URLs', () => {
  const service = new GoogleDrivePhotoService();

  assert.equal(
    service.extractDriveFolderId('https://drive.google.com/drive/folders/FOLDER_ID'),
    'FOLDER_ID',
  );
  assert.equal(
    service.extractDriveFolderId('https://drive.google.com/drive/folders/abc-123_DEF?usp=sharing'),
    'abc-123_DEF',
  );
  assert.equal(service.extractDriveFolderId('https://example.com/no-folder'), undefined);
});

test('getImagesFromDriveFolder returns a row-safe error when API key is missing', async () => {
  const service = new GoogleDrivePhotoService();
  const previousApiKey = process.env.GOOGLE_DRIVE_API_KEY;
  delete process.env.GOOGLE_DRIVE_API_KEY;

  try {
    const result = await service.getImagesFromDriveFolder(
      'https://drive.google.com/drive/folders/FOLDER_ID',
    );

    assert.deepEqual(result.photos, []);
    assert.equal(result.error, 'GOOGLE_DRIVE_API_KEY is not configured');
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.GOOGLE_DRIVE_API_KEY;
    } else {
      process.env.GOOGLE_DRIVE_API_KEY = previousApiKey;
    }
  }
});

test('getImageFile proxies valid public Drive image bytes', async () => {
  const service = new GoogleDrivePhotoService();
  const originalFetch = globalThis.fetch;
  const previousApiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const requests: string[] = [];
  process.env.GOOGLE_DRIVE_API_KEY = 'test-api-key';

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return new Response(Buffer.from('image-bytes'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    });
  }) as typeof fetch;

  try {
    const result = await service.getImageFile('1ZpcWwtoGcWb1vfb0878sB8QSz6s63r72', '1200');

    assert.equal(result.contentType, 'image/jpeg');
    assert.equal(result.buffer.toString(), 'image-bytes');
    assert.equal(
      requests[0],
      'https://lh3.googleusercontent.com/d/1ZpcWwtoGcWb1vfb0878sB8QSz6s63r72=w1200',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.GOOGLE_DRIVE_API_KEY;
    } else {
      process.env.GOOGLE_DRIVE_API_KEY = previousApiKey;
    }
  }
});

test('getImageFile rejects invalid Drive file IDs', async () => {
  const service = new GoogleDrivePhotoService();

  await assert.rejects(
    () => service.getImageFile('../bad-id'),
    /Google Drive file ID is invalid/,
  );
});
