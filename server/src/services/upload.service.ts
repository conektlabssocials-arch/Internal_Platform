import { v2 as cloudinary } from 'cloudinary';
import { injectable } from 'tsyringe';

import { HttpError } from '../utils/httpError.js';

export type UploadedImage = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

export interface IUploadService {
  uploadImage(file: {
    buffer: Buffer;
    mimetype: string;
    fileName?: string;
    folder?: string;
  }): Promise<UploadedImage>;
  deleteImage(publicId: string): Promise<void>;
}

const isConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

@injectable()
export class UploadService implements IUploadService {
  private configured = false;

  private ensureConfigured() {
    if (this.configured) {
      return;
    }

    if (!isConfigured()) {
      throw new HttpError(500, 'Image uploads are not configured');
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    this.configured = true;
  }

  async uploadImage(file: {
    buffer: Buffer;
    mimetype: string;
    fileName?: string;
    folder?: string;
  }): Promise<UploadedImage> {
    this.ensureConfigured();

    if (!file.mimetype.startsWith('image/')) {
      throw new HttpError(400, 'Only image files can be uploaded');
    }

    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const folder =
      file.folder || process.env.CLOUDINARY_UPLOAD_FOLDER || 'inventory';

    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        resource_type: 'image',
        filename_override: file.fileName,
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image upload failed';
      throw new HttpError(502, message);
    }
  }

  async deleteImage(publicId: string) {
    this.ensureConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });
  }
}
