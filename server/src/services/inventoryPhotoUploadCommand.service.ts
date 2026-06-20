import { inject, injectable } from 'tsyringe';

import { TOKENS } from '../config/tokens.js';
import type { InventoryDto } from '../dto/inventory.dto.js';
import type { UserRole } from '../models/user.model.js';
import type { CampaignCommandActor } from './campaignCommand.service.js';
import type { IInventoryService } from './inventory.service.js';
import type { IPlatformSettingsService } from './platformSettings.service.js';
import type { IUploadService, UploadDto } from './upload.service.js';
import { HttpError } from '../utils/httpError.js';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const defaultMaxBytes = 6 * 1024 * 1024;

export type InventoryPhotoUploadInput = {
  expectedUpdatedAt: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
};

export interface IInventoryPhotoUploadCommandService {
  uploadAndAttach(
    inventoryId: string,
    input: InventoryPhotoUploadInput,
    actor: CampaignCommandActor,
  ): Promise<{ inventory: InventoryDto; uploads: UploadDto[] }>;
}

const maxUploadBytes = () => {
  const configured = Number(process.env.MCP_MAX_UPLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : defaultMaxBytes;
};

const decodeBase64Image = (value: string) => {
  const normalized = value.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new HttpError(400, 'base64Data is invalid');
  }
  const buffer = Buffer.from(normalized, 'base64');
  if (!buffer.length) throw new HttpError(400, 'Uploaded image is empty');
  if (buffer.length > maxUploadBytes()) {
    throw new HttpError(
      413,
      `Uploaded image exceeds the ${maxUploadBytes()} byte MCP limit`,
    );
  }
  return buffer;
};

const timestamp = (value?: Date | string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

@injectable()
export class InventoryPhotoUploadCommandService
  implements IInventoryPhotoUploadCommandService
{
  constructor(
    @inject(TOKENS.InventoryService)
    private readonly inventory: IInventoryService,
    @inject(TOKENS.UploadService)
    private readonly uploads: IUploadService,
    @inject(TOKENS.PlatformSettingsService)
    private readonly platformSettings: IPlatformSettingsService,
  ) {}

  async uploadAndAttach(
    inventoryId: string,
    input: InventoryPhotoUploadInput,
    actor: CampaignCommandActor,
  ) {
    if (
      !(await this.platformSettings.hasPermission(
        actor.role as UserRole,
        'uploads.manage',
      ))
    ) {
      throw new HttpError(403, 'You do not have permission to manage uploads');
    }
    if (!allowedMimeTypes.has(input.mimeType)) {
      throw new HttpError(400, 'Inventory photo must be JPEG, PNG, or WebP');
    }
    const fileName = input.fileName.trim();
    if (!fileName || fileName.length > 180) {
      throw new HttpError(400, 'fileName is required and must be under 180 characters');
    }

    const before = await this.inventory.getInventoryById(inventoryId);
    if (timestamp(before.updatedAt) !== timestamp(input.expectedUpdatedAt)) {
      throw new HttpError(
        409,
        'Inventory changed since it was read. Read it again before uploading a photo.',
      );
    }

    const buffer = decodeBase64Image(input.base64Data);
    // Build a Multer-shaped file and reuse the REST upload path, which validates
    // the byte signature, stores to Cloudinary, records the Upload, attaches it to
    // the inventory item, and logs the activity.
    const file = {
      buffer,
      mimetype: input.mimeType,
      originalname: fileName,
      size: buffer.length,
    } as Express.Multer.File;

    const uploads = await this.uploads.uploadInventoryPhotos(inventoryId, [file], {
      userId: actor.userId,
      email: actor.email,
      role: actor.role as UserRole,
    });
    const inventory = await this.inventory.getInventoryById(inventoryId);
    return { inventory, uploads };
  }
}
