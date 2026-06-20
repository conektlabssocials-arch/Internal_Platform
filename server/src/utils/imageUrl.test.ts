import assert from 'node:assert/strict';
import test from 'node:test';

import { isCloudinaryImageUrl, optimizeCloudinaryImageUrl } from './imageUrl.js';

test('inserts a downscaling JPEG transformation into versioned Cloudinary image URLs', () => {
  const url =
    'https://res.cloudinary.com/do1w46bzr/image/upload/v1781872571/inventory/inventory_photo/abc/screenshot.png';
  assert.equal(
    optimizeCloudinaryImageUrl(url),
    'https://res.cloudinary.com/do1w46bzr/image/upload/c_limit,w_900,q_auto,f_jpg/v1781872571/inventory/inventory_photo/abc/screenshot.png',
  );
});

test('honours DOCUMENT_IMAGE_MAX_WIDTH override', () => {
  process.env.DOCUMENT_IMAGE_MAX_WIDTH = '600';
  try {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.png';
    assert.equal(
      optimizeCloudinaryImageUrl(url),
      'https://res.cloudinary.com/demo/image/upload/c_limit,w_600,q_auto,f_jpg/v1/photo.png',
    );
  } finally {
    delete process.env.DOCUMENT_IMAGE_MAX_WIDTH;
  }
});

test('does not double-apply when a transformation is already present', () => {
  const url =
    'https://res.cloudinary.com/do1w46bzr/image/upload/c_fill,w_500/v1781872571/inventory/photo.png';
  assert.equal(optimizeCloudinaryImageUrl(url), url);
});

test('leaves non-Cloudinary and non-image URLs untouched', () => {
  const drive = 'https://drive.google.com/uc?id=abc123';
  const video = 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4';
  assert.equal(optimizeCloudinaryImageUrl(drive), drive);
  assert.equal(optimizeCloudinaryImageUrl(video), video);
});

test('isCloudinaryImageUrl detects only Cloudinary image delivery URLs', () => {
  assert.equal(
    isCloudinaryImageUrl('https://res.cloudinary.com/demo/image/upload/v1/photo.png'),
    true,
  );
  assert.equal(
    isCloudinaryImageUrl('https://res.cloudinary.com/demo/video/upload/v1/clip.mp4'),
    false,
  );
  assert.equal(isCloudinaryImageUrl('https://drive.google.com/uc?id=abc'), false);
});
