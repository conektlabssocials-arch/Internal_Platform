import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { injectable } from 'tsyringe';

import type { UploadCategory } from '../models/upload.model.js';
import { HttpError } from '../utils/httpError.js';

export type StoredUpload = {
  publicId: string;
  secureUrl: string;
  resourceType: string;
  deliveryType: string;
  format?: string;
  bytes: number;
  fileName: string;
};

export interface IUploadStorageService {
  upload(
    file: Express.Multer.File,
    options: { category: UploadCategory; publicSafe: boolean; folder: string },
  ): Promise<StoredUpload>;
  getPrivateDownloadUrl(upload: {
    storageKey: string;
    storageResourceType: string;
    storageDeliveryType: string;
    storageFormat?: string | null;
  }): string;
  delete(upload: {
    storageKey: string;
    storageResourceType: string;
    storageDeliveryType: string;
  }): Promise<void>;
}

const safeBaseName = (originalName: string) => {
  const parsed = path.parse(originalName);
  const base = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';
  return `${Date.now()}-${randomBytes(8).toString('hex')}-${base}`;
};

const resourceType = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
};

@injectable()
export class UploadStorageService implements IUploadStorageService {
  private configured = false;

  private ensureConfigured() {
    if (this.configured) return;
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new HttpError(500, 'Cloudinary upload storage is not configured');
    }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    this.configured = true;
  }

  async upload(
    file: Express.Multer.File,
    options: { category: UploadCategory; publicSafe: boolean; folder: string },
  ) {
    this.ensureConfigured();
    const type = options.publicSafe ? 'upload' : 'authenticated';
    const fileResourceType = resourceType(file.mimetype);
    const publicId = safeBaseName(file.originalname);

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: fileResourceType as 'image' | 'video' | 'raw',
          type,
          folder: options.folder,
          public_id: publicId,
          filename_override: file.originalname,
          use_filename: false,
          unique_filename: false,
          overwrite: false,
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error || new Error('Cloudinary upload failed'));
            return;
          }
          resolve(uploadResult);
        },
      );
      stream.on('error', reject);
      Readable.from(file.buffer).pipe(stream);
    }).catch((error) => {
      throw new HttpError(
        502,
        error instanceof Error ? error.message : 'Cloudinary upload failed',
      );
    });

    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      resourceType: result.resource_type || fileResourceType,
      deliveryType: result.type || type,
      format: result.format || path.extname(file.originalname).replace('.', '') || undefined,
      bytes: result.bytes || file.size,
      fileName: `${publicId}${path.extname(file.originalname).toLowerCase()}`,
    };
  }

  getPrivateDownloadUrl(upload: {
    storageKey: string;
    storageResourceType: string;
    storageDeliveryType: string;
    storageFormat?: string | null;
  }) {
    this.ensureConfigured();
    return cloudinary.utils.private_download_url(
      upload.storageKey,
      upload.storageFormat || '',
      {
        resource_type: upload.storageResourceType,
        type: upload.storageDeliveryType,
        attachment: true,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      },
    );
  }

  async delete(upload: {
    storageKey: string;
    storageResourceType: string;
    storageDeliveryType: string;
  }) {
    this.ensureConfigured();
    await cloudinary.uploader.destroy(upload.storageKey, {
      resource_type: upload.storageResourceType as 'image' | 'video' | 'raw',
      type: upload.storageDeliveryType,
      invalidate: true,
    });
  }
}
