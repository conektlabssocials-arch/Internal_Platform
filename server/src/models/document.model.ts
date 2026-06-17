import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const documentTypes = [
  'PlanProposal',
  'PlanProposalV2',
  'Quotation',
  'InternalCostSheet',
  'WorkOrder',
  'PurchaseOrder',
  'ExecutionReport',
] as const;

const documentMetadataSchema = new Schema(
  {
    planVersionLabel: String,
    campaignCode: String,
    campaignTitle: String,
    clientName: String,
    operationCode: String,
    supplierName: String,
    poNumber: String,
    partial: Boolean,
    grandTotal: Number,
  },
  { _id: false },
);

const documentSchema = new Schema(
  {
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    operation: { type: Schema.Types.ObjectId, ref: 'Operation' },
    documentType: { type: String, enum: documentTypes, required: true },
    versionNumber: { type: Number, required: true },
    fileName: { type: String, required: true },
    // Empty while a document is still being generated in the background; set once
    // the PDF is uploaded.
    filePath: { type: String, default: '' },
    fileUrl: String,
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      default: 'ready',
    },
    // 0-100 generation progress, only meaningful while status is 'processing'.
    progress: { type: Number, default: 0 },
    error: String,
    storageProvider: { type: String, enum: ['local', 'cloudinary'], default: 'local' },
    storageKey: String,
    storageResourceType: { type: String, default: 'raw' },
    storageDeliveryType: { type: String, default: 'authenticated' },
    storageFormat: { type: String, default: 'pdf' },
    storageBytes: Number,
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    generatedAt: { type: Date, default: Date.now },
    metadata: { type: documentMetadataSchema, default: () => ({}) },
  },
  { timestamps: true },
);

documentSchema.index({ plan: 1, generatedAt: -1 });

export type DocumentType = (typeof documentTypes)[number];
export type DocumentSchema = InferSchemaType<typeof documentSchema>;
export type DocumentDocument = HydratedDocument<DocumentSchema>;

export const DocumentModel = mongoose.model<DocumentSchema>('Document', documentSchema);
