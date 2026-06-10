import type { UploadCategory } from '../models/upload.model.js';

export type UploadRule = {
  allowedMimeTypes: readonly string[];
  maxFileBytes: number;
  maxFiles: number;
  isPublicSafe: boolean;
};

const MB = 1024 * 1024;

export const MAX_UPLOAD_REQUEST_BYTES = 50 * MB;

export const UPLOAD_RULES: Record<UploadCategory, UploadRule> = {
  inventory_photo: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFileBytes: 10 * MB,
    maxFiles: 10,
    isPublicSafe: true,
  },
  creative: {
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'application/zip',
      'application/x-zip-compressed',
    ],
    maxFileBytes: 50 * MB,
    maxFiles: 10,
    isPublicSafe: false,
  },
  purchase_order: {
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    maxFileBytes: 20 * MB,
    maxFiles: 5,
    isPublicSafe: false,
  },
  proof: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFileBytes: 15 * MB,
    maxFiles: 20,
    isPublicSafe: true,
  },
  document: {
    allowedMimeTypes: ['application/pdf'],
    maxFileBytes: 30 * MB,
    maxFiles: 1,
    isPublicSafe: false,
  },
  other: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxFileBytes: 10 * MB,
    maxFiles: 5,
    isPublicSafe: false,
  },
};
