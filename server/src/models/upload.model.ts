import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const uploadCategories = [
  'inventory_photo',
  'creative',
  'purchase_order',
  'proof',
  'document',
  'other',
] as const;

export const uploadEntityTypes = [
  'Inventory',
  'Operation',
  'OperationItem',
  'Document',
  'CRM',
  'Campaign',
  'Plan',
  'Other',
] as const;

const uploadSchema = new Schema(
  {
    originalName: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    storageProvider: {
      type: String,
      enum: ['cloudinary'],
      default: 'cloudinary',
      required: true,
    },
    storageKey: { type: String, required: true, unique: true },
    storageResourceType: { type: String, required: true },
    storageDeliveryType: { type: String, required: true },
    storageFormat: String,
    url: String,
    category: { type: String, enum: uploadCategories, required: true, index: true },
    entityType: { type: String, enum: uploadEntityTypes, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPublicSafe: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'deleted'], default: 'active', index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

uploadSchema.index({ entityType: 1, entityId: 1, category: 1, status: 1, createdAt: -1 });

export type UploadCategory = (typeof uploadCategories)[number];
export type UploadEntityType = (typeof uploadEntityTypes)[number];
export type UploadSchema = InferSchemaType<typeof uploadSchema>;
export type UploadDocument = HydratedDocument<UploadSchema>;
export const UploadModel = mongoose.model<UploadSchema>('Upload', uploadSchema);
