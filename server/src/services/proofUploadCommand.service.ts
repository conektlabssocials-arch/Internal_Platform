import { inject, injectable } from 'tsyringe';

import { TOKENS } from '../config/tokens.js';
import type { CampaignCommandActor } from './campaignCommand.service.js';
import type { IOperationCommandService } from './operationCommand.service.js';
import type { IOperationService } from './operation.service.js';
import type { IUploadService, UploadedImage } from './upload.service.js';
import { HttpError } from '../utils/httpError.js';

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const defaultMaxBytes = 6 * 1024 * 1024;

export type ProofUploadInput = {
  expectedUpdatedAt: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
  notes?: string;
};

export interface IProofUploadCommandService {
  uploadAndAttach(
    operationId: string,
    itemId: string,
    input: ProofUploadInput,
    actor: CampaignCommandActor,
  ): Promise<{ operation: unknown; upload: UploadedImage }>;
}

const maxUploadBytes = () => {
  const configured = Number(process.env.MCP_MAX_UPLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : defaultMaxBytes;
};

const decodeBase64 = (value: string) => {
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

const isExpectedImage = (buffer: Buffer, mimeType: string) => {
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
};

const timestamp = (value?: Date | string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

@injectable()
export class ProofUploadCommandService
  implements IProofUploadCommandService
{
  constructor(
    @inject(TOKENS.OperationService)
    private readonly operations: IOperationService,
    @inject(TOKENS.OperationCommandService)
    private readonly operationCommands: IOperationCommandService,
    @inject(TOKENS.UploadService)
    private readonly uploads: IUploadService,
  ) {}

  async uploadAndAttach(
    operationId: string,
    itemId: string,
    input: ProofUploadInput,
    actor: CampaignCommandActor,
  ) {
    if (!allowedMimeTypes.has(input.mimeType)) {
      throw new HttpError(400, 'Proof image must be JPEG, PNG, or WebP');
    }
    const fileName = input.fileName.trim();
    if (!fileName || fileName.length > 180) {
      throw new HttpError(400, 'fileName is required and must be under 180 characters');
    }

    const operation = (await this.operations.getById(operationId)) as {
      operationCode: string;
      updatedAt?: Date | string;
      items: {
        id: string;
        proof?: { photoUrls?: string[]; notes?: string };
      }[];
    };
    if (
      timestamp(operation.updatedAt) !== timestamp(input.expectedUpdatedAt)
    ) {
      throw new HttpError(
        409,
        'Operation changed since it was read. Read the operation again before uploading proof.',
      );
    }
    const item = operation.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new HttpError(404, 'Operation item not found');
    const buffer = decodeBase64(input.base64Data);
    if (!isExpectedImage(buffer, input.mimeType)) {
      throw new HttpError(400, 'Image content does not match mimeType');
    }

    const upload = await this.uploads.uploadImage({
      buffer,
      mimetype: input.mimeType,
      fileName,
      folder: `operations/${operation.operationCode}/proof`,
    });

    try {
      const updatedOperation = await this.operationCommands.updateItem(
        operationId,
        itemId,
        'proof',
        {
          expectedUpdatedAt: input.expectedUpdatedAt,
          mutation: {
            uploaded: true,
            photoUrls: [...(item.proof?.photoUrls || []), upload.url],
            notes: input.notes ?? item.proof?.notes,
          },
        },
        actor,
      );

      return { operation: updatedOperation, upload };
    } catch (error) {
      await this.uploads.deleteImage(upload.publicId).catch(() => undefined);
      throw error;
    }
  }
}
