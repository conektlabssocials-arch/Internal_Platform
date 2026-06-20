import path from 'node:path';
import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';
import type { Request } from 'express';

import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import { UPLOAD_RULES } from '../constants/upload.constants.js';
import { TOKENS } from '../config/tokens.js';
import { mapOperationToDto } from '../dto/operation.dto.js';
import type {
  UploadCategory,
  UploadDocument,
  UploadEntityType,
} from '../models/upload.model.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IOperationRepository } from '../repositories/operation.repository.js';
import type { IUploadRepository } from '../repositories/upload.repository.js';
import type { AuthTokenPayload } from '../types/auth.js';
import {
  calculateImportantDates,
  calculateItemStatus,
  calculateOperationProgress,
  calculateOperationStatus,
} from '../utils/operationStatus.js';
import { HttpError } from '../utils/httpError.js';
import type { IActivityService } from './activity.service.js';
import type {
  IUploadStorageService,
  StoredUpload,
} from './uploadStorage.service.js';

export type UploadedImage = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

export type UploadDto = {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: UploadCategory;
  entityType: UploadEntityType;
  entityId?: string;
  isPublicSafe: boolean;
  status: string;
  url: string;
  publicUrl?: string;
  providerUrl?: string;
  uploadedBy?: { id: string; name?: string; email?: string };
  metadata: Record<string, unknown>;
  createdAt?: Date;
};

type UploadContext = {
  category: UploadCategory;
  entityType: UploadEntityType;
  entityId: string;
  itemId?: string;
  files: Express.Multer.File[];
  actor: AuthTokenPayload;
  req?: Request;
};

export interface IUploadService {
  uploadImage(file: {
    buffer: Buffer;
    mimetype: string;
    fileName?: string;
    folder?: string;
  }): Promise<UploadedImage>;
  deleteImage(publicId: string): Promise<void>;
  uploadInventoryPhotos(
    inventoryId: string,
    files: Express.Multer.File[],
    actor: AuthTokenPayload,
    req?: Request,
  ): Promise<UploadDto[]>;
  uploadOperationFiles(
    operationId: string,
    itemId: string,
    category: 'creative' | 'purchase_order' | 'proof',
    files: Express.Multer.File[],
    actor: AuthTokenPayload,
    req?: Request,
  ): Promise<{ uploads: UploadDto[]; operation: unknown }>;
  list(filters: Record<string, string | undefined>): Promise<UploadDto[]>;
  get(id: string): Promise<UploadDto>;
  getInternalDownload(id: string): Promise<{ url: string; fileName: string }>;
  getPublicDownload(id: string): Promise<{ url: string; fileName: string }>;
  delete(id: string, actor: AuthTokenPayload, req?: Request): Promise<void>;
}

const isObjectId = (value: string) => Types.ObjectId.isValid(value);
const objectId = (value: string) => new Types.ObjectId(value);
const internalUrl = (id: string) => `/api/uploads/${id}/download`;
const publicUrl = (id: string) => `/api/public/uploads/${id}`;

/**
 * Inspect the file's leading bytes (magic numbers) and return the MIME type its
 * content actually represents, ignoring the declared `mimetype` (which the
 * browser derives from the file extension and is therefore unreliable, e.g. a
 * PNG saved as `logo.jpg`). Returns `undefined` when the bytes match no
 * supported signature.
 */
export const detectMimeFromSignature = (buffer: Buffer): string | undefined => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return 'video/mp4';
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(buffer[2]) &&
    [0x04, 0x06, 0x08].includes(buffer[3])
  ) {
    return 'application/zip';
  }
  return undefined;
};

export const validateUploadFiles = (
  category: UploadCategory,
  files: Express.Multer.File[],
) => {
  const rule = UPLOAD_RULES[category];
  if (!files.length) throw new HttpError(400, 'At least one file is required');
  if (files.length > rule.maxFiles) {
    throw new HttpError(400, `A maximum of ${rule.maxFiles} files can be uploaded`);
  }
  for (const file of files) {
    if (!rule.allowedMimeTypes.includes(file.mimetype)) {
      throw new HttpError(400, `${file.mimetype || 'File type'} is not supported`);
    }
    if (!file.size || file.size > rule.maxFileBytes) {
      throw new HttpError(
        413,
        `${file.originalname} exceeds the ${Math.round(rule.maxFileBytes / 1024 / 1024)} MB limit`,
      );
    }
    // Trust the file's actual bytes, not its (extension-derived) declared type.
    // This lets correctly-formatted files with a mismatched extension through
    // (e.g. a PNG named `logo.jpg`) while still rejecting unsupported content.
    const detected = detectMimeFromSignature(file.buffer);
    if (!detected || !rule.allowedMimeTypes.includes(detected)) {
      throw new HttpError(400, `${file.originalname} content does not match its file type`);
    }
    // Correct the declared type so the real format is what gets stored.
    file.mimetype = detected;
  }
};

@injectable()
export class UploadService implements IUploadService {
  constructor(
    @inject(TOKENS.UploadRepository)
    private readonly uploads: IUploadRepository,
    @inject(TOKENS.UploadStorageService)
    private readonly storage: IUploadStorageService,
    @inject(TOKENS.InventoryRepository)
    private readonly inventory: IInventoryRepository,
    @inject(TOKENS.OperationRepository)
    private readonly operations: IOperationRepository,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  async uploadImage(file: {
    buffer: Buffer;
    mimetype: string;
    fileName?: string;
    folder?: string;
  }) {
    const multerFile = {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.fileName || 'image',
      size: file.buffer.length,
    } as Express.Multer.File;
    validateUploadFiles('inventory_photo', [multerFile]);
    const stored = await this.storage.upload(multerFile, {
      category: 'inventory_photo',
      publicSafe: true,
      folder: file.folder || process.env.CLOUDINARY_UPLOAD_FOLDER || 'inventory',
    });
    return {
      url: stored.secureUrl,
      publicId: stored.publicId,
      format: stored.format,
      bytes: stored.bytes,
    };
  }

  deleteImage(publicId: string) {
    return this.storage.delete({
      storageKey: publicId,
      storageResourceType: 'image',
      storageDeliveryType: 'upload',
    });
  }

  async uploadInventoryPhotos(
    inventoryId: string,
    files: Express.Multer.File[],
    actor: AuthTokenPayload,
    req?: Request,
  ) {
    if (!isObjectId(inventoryId)) throw new HttpError(400, 'inventoryId is invalid');
    const item = await this.inventory.findById(inventoryId);
    if (!item) throw new HttpError(404, 'Inventory item not found');

    const records = await this.uploadAndRecord({
      category: 'inventory_photo',
      entityType: 'Inventory',
      entityId: inventoryId,
      files,
      actor,
      req,
    });

    try {
      item.photoUploads = [
        ...(item.photoUploads || []),
        ...records.map((record) => record._id),
      ] as any;
      item.photos = [
        ...(item.photos || []),
        ...records.map((record) => record.url).filter(Boolean) as string[],
      ];
      item.updatedBy = objectId(actor.userId);
      await this.inventory.save(item);
    } catch (error) {
      await this.rollback(records);
      throw error;
    }

    await this.logUpload(records, actor, {
      entityType: 'Inventory',
      entityId: inventoryId,
      entityCode: item.inventoryCode,
      entityTitle: item.title,
      req,
    });
    return records.map(this.mapUpload);
  }

  async uploadOperationFiles(
    operationId: string,
    itemId: string,
    category: 'creative' | 'purchase_order' | 'proof',
    files: Express.Multer.File[],
    actor: AuthTokenPayload,
    req?: Request,
  ) {
    if (!isObjectId(operationId)) throw new HttpError(400, 'operationId is invalid');
    const operation = await this.operations.findByIdPopulated(operationId);
    if (!operation) throw new HttpError(404, 'Operation not found');
    const item = (operation.items as any[]).find(
      (candidate) => candidate._id.toString() === itemId,
    );
    if (!item) throw new HttpError(404, 'Operation item not found');

    const records = await this.uploadAndRecord({
      category,
      entityType: 'OperationItem',
      entityId: operationId,
      itemId,
      files,
      actor,
      req,
    });
    const ids = records.map((record) => record._id);

    try {
      if (category === 'creative') {
        item.creative.fileUploads = [...(item.creative.fileUploads || []), ...ids];
        item.creative.fileUrls = [
          ...(item.creative.fileUrls || []),
          ...records.map((record) => internalUrl(record._id.toString())),
        ];
        item.creative.required = true;
        item.creative.received = true;
        item.creative.receivedAt ||= new Date();
      } else if (category === 'purchase_order') {
        item.purchaseOrder.fileUploads = [
          ...(item.purchaseOrder.fileUploads || []),
          ...ids,
        ];
        item.purchaseOrder.poFileUrl ||= internalUrl(records[0]._id.toString());
        item.purchaseOrder.required = true;
        item.purchaseOrder.sent = true;
        item.purchaseOrder.sentAt ||= new Date();
      } else {
        item.proof.fileUploads = [...(item.proof.fileUploads || []), ...ids];
        item.proof.photoUrls = [
          ...(item.proof.photoUrls || []),
          ...records.map((record) => record.url).filter(Boolean),
        ];
        item.proof.uploaded = true;
        item.proof.uploadedAt ||= new Date();
      }
      item.itemStatus = calculateItemStatus(item);
      const items = operation.items as any[];
      operation.overallProgress = calculateOperationProgress(items);
      operation.importantDates = calculateImportantDates(items);
      operation.status = calculateOperationStatus(items, operation.status);
      operation.updatedBy = objectId(actor.userId);
      await this.operations.save(operation);
    } catch (error) {
      await this.rollback(records);
      throw error;
    }

    await this.logUpload(records, actor, {
      entityType: 'OperationItem',
      entityId: itemId,
      entityCode: item.inventoryCode,
      entityTitle: item.title,
      parentEntityType: 'Operation',
      parentEntityId: operationId,
      parentEntityCode: operation.operationCode,
      req,
    });
    const refreshed = await this.operations.findByIdPopulated(operationId);
    return {
      uploads: records.map(this.mapUpload),
      operation: refreshed ? mapOperationToDto(refreshed) : null,
    };
  }

  async list(filters: Record<string, string | undefined>) {
    const query: FilterQuery<unknown> = { status: 'active' };
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) {
      if (!isObjectId(filters.entityId)) throw new HttpError(400, 'entityId is invalid');
      query.entityId = objectId(filters.entityId);
    }
    if (filters.category) query.category = filters.category;
    if (filters.itemId) query['metadata.itemId'] = filters.itemId;
    return (await this.uploads.findFiltered(query)).map(this.mapUpload);
  }

  async get(id: string) {
    return this.mapUpload(await this.requireUpload(id));
  }

  async getInternalDownload(id: string) {
    const upload = await this.requireUpload(id);
    return {
      url: upload.isPublicSafe && upload.url
        ? upload.url
        : this.storage.getPrivateDownloadUrl(upload),
      fileName: upload.originalName,
    };
  }

  async getPublicDownload(id: string) {
    const upload = await this.requireUpload(id);
    if (!upload.isPublicSafe || !upload.url) throw new HttpError(404, 'Upload not found');
    return { url: upload.url, fileName: upload.originalName };
  }

  async delete(id: string, actor: AuthTokenPayload, req?: Request) {
    const upload = await this.requireUpload(id);
    await this.storage.delete(upload);
    await this.detach(upload, actor.userId);
    upload.status = 'deleted';
    await this.uploads.save(upload);
    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.UPLOAD_DELETED,
      entityType: upload.entityType,
      entityId:
        upload.entityType === 'OperationItem'
          ? upload.metadata?.itemId?.toString()
          : upload.entityId?.toString(),
      entityTitle: upload.originalName,
      message: `${upload.category} upload was deleted.`,
      metadata: { category: upload.category, count: 1 },
      req,
    });
  }

  private async uploadAndRecord(context: UploadContext) {
    validateUploadFiles(context.category, context.files);
    const rule = UPLOAD_RULES[context.category];
    const records: UploadDocument[] = [];
    try {
      for (const file of context.files) {
        const stored = await this.storage.upload(file, {
          category: context.category,
          publicSafe: rule.isPublicSafe,
          folder: this.folderFor(context),
        });
        try {
          const record = await this.uploads.create({
            originalName: path.basename(file.originalname).slice(0, 255),
            fileName: stored.fileName,
            mimeType: file.mimetype,
            size: stored.bytes || file.size,
            storageProvider: 'cloudinary',
            storageKey: stored.publicId,
            storageResourceType: stored.resourceType,
            storageDeliveryType: stored.deliveryType,
            storageFormat: stored.format,
            url: rule.isPublicSafe ? stored.secureUrl : undefined,
            category: context.category,
            entityType: context.entityType,
            entityId: objectId(context.entityId),
            uploadedBy: objectId(context.actor.userId),
            isPublicSafe: rule.isPublicSafe,
            metadata: context.itemId ? { itemId: context.itemId } : {},
          });
          records.push(record);
        } catch (error) {
          await this.storage.delete({
            storageKey: stored.publicId,
            storageResourceType: stored.resourceType,
            storageDeliveryType: stored.deliveryType,
          }).catch(() => undefined);
          throw error;
        }
      }
      return records;
    } catch (error) {
      await this.rollback(records);
      throw error;
    }
  }

  private async rollback(records: UploadDocument[]) {
    await Promise.all(records.map(async (record) => {
      await this.storage.delete(record).catch(() => undefined);
      await this.uploads.hardDelete(record._id.toString()).catch(() => undefined);
    }));
  }

  private async detach(upload: UploadDocument, actorId: string) {
    const id = upload._id.toString();
    if (upload.entityType === 'Inventory' && upload.entityId) {
      const item = await this.inventory.findById(upload.entityId.toString());
      if (item) {
        item.photoUploads = (item.photoUploads || []).filter((value) => value.toString() !== id) as any;
        item.photos = (item.photos || []).filter((value) => value !== upload.url);
        item.updatedBy = objectId(actorId);
        await this.inventory.save(item);
      }
      return;
    }
    if (upload.entityType === 'OperationItem' && upload.entityId) {
      const operation = await this.operations.findByIdPopulated(upload.entityId.toString());
      const itemId = upload.metadata?.itemId?.toString();
      const item = (operation?.items as any[] | undefined)?.find(
        (candidate) => candidate._id.toString() === itemId,
      );
      if (!operation || !item) return;
      const removeId = (values: any[] = []) => values.filter((value) => value.toString() !== id);
      if (upload.category === 'creative') {
        item.creative.fileUploads = removeId(item.creative.fileUploads);
        item.creative.fileUrls = (item.creative.fileUrls || []).filter(
          (value: string) => value !== internalUrl(id),
        );
      } else if (upload.category === 'purchase_order') {
        item.purchaseOrder.fileUploads = removeId(item.purchaseOrder.fileUploads);
        if (item.purchaseOrder.poFileUrl === internalUrl(id)) {
          const nextId = item.purchaseOrder.fileUploads[0]?.toString();
          item.purchaseOrder.poFileUrl = nextId ? internalUrl(nextId) : undefined;
        }
      } else if (upload.category === 'proof') {
        item.proof.fileUploads = removeId(item.proof.fileUploads);
        item.proof.photoUrls = (item.proof.photoUrls || []).filter(
          (value: string) => value !== upload.url,
        );
        if (!item.proof.fileUploads.length && !item.proof.photoUrls.length) {
          item.proof.uploaded = false;
          item.proof.uploadedAt = undefined;
        }
      }
      item.itemStatus = calculateItemStatus(item);
      const items = operation.items as any[];
      operation.overallProgress = calculateOperationProgress(items);
      operation.importantDates = calculateImportantDates(items);
      operation.status = calculateOperationStatus(items, operation.status);
      operation.updatedBy = objectId(actorId);
      await this.operations.save(operation);
    }
  }

  private async requireUpload(id: string) {
    if (!isObjectId(id)) throw new HttpError(400, 'uploadId is invalid');
    const upload = await this.uploads.findActiveById(id);
    if (!upload) throw new HttpError(404, 'Upload not found');
    return upload;
  }

  private folderFor(context: UploadContext) {
    const root = process.env.CLOUDINARY_UPLOAD_FOLDER || 'conekt-ads';
    return `${root}/${context.category}/${context.entityId}${context.itemId ? `/${context.itemId}` : ''}`;
  }

  private logUpload(
    records: UploadDocument[],
    actor: AuthTokenPayload,
    entity: {
      entityType: string;
      entityId?: string;
      entityCode?: string;
      entityTitle?: string;
      parentEntityType?: string;
      parentEntityId?: string;
      parentEntityCode?: string;
      req?: Request;
    },
  ) {
    return this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.FILES_UPLOADED,
      ...entity,
      message: `${records.length} ${records.length === 1 ? 'file was' : 'files were'} uploaded.`,
      metadata: { category: records[0]?.category, count: records.length },
    });
  }

  private mapUpload = (upload: UploadDocument): UploadDto => {
    const uploader = upload.uploadedBy as any;
    return {
      id: upload._id.toString(),
      originalName: upload.originalName,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      size: upload.size,
      category: upload.category,
      entityType: upload.entityType,
      entityId: upload.entityId?.toString(),
      isPublicSafe: upload.isPublicSafe,
      status: upload.status,
      url: internalUrl(upload._id.toString()),
      publicUrl: upload.isPublicSafe ? publicUrl(upload._id.toString()) : undefined,
      providerUrl: upload.isPublicSafe ? upload.url || undefined : undefined,
      uploadedBy: uploader?._id
        ? { id: uploader._id.toString(), name: uploader.name, email: uploader.email }
        : undefined,
      metadata: (upload.metadata || {}) as Record<string, unknown>,
      createdAt: upload.createdAt,
    };
  };
}
