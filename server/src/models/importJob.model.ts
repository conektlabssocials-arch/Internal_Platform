import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

export const importTypes = ['inventory', 'crm_entities', 'contacts'] as const;
export const importJobStatuses = [
  'uploaded',
  'validated',
  'imported',
  'failed',
  'cancelled',
] as const;

export type ImportType = (typeof importTypes)[number];
export type ImportJobStatus = (typeof importJobStatuses)[number];

export type ImportIssue = {
  rowNumber: number;
  field: string;
  message: string;
  value?: string;
};

export type ImportRowStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'duplicate'
  | 'imported'
  | 'skipped';

export type ImportStoredRow = {
  rowNumber: number;
  status: ImportRowStatus;
  data: Record<string, unknown>;
  errors?: ImportIssue[];
  warnings?: ImportIssue[];
};

export type ImportJobSchema = {
  importType: ImportType;
  status: ImportJobStatus;
  fileName?: string;
  originalName?: string;
  uploadedBy: mongoose.Types.ObjectId;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  previewRows: ImportStoredRow[];
  validatedRows: ImportStoredRow[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const issueSchema = new Schema<ImportIssue>(
  {
    rowNumber: { type: Number, required: true },
    field: { type: String, required: true },
    message: { type: String, required: true },
    value: String,
  },
  { _id: false, suppressReservedKeysWarning: true },
);

const storedRowSchema = new Schema<ImportStoredRow>(
  {
    rowNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'valid', 'invalid', 'duplicate', 'imported', 'skipped'],
      required: true,
    },
    data: { type: Schema.Types.Mixed, required: true },
    errors: { type: [issueSchema], default: [] },
    warnings: { type: [issueSchema], default: [] },
  },
  { _id: false, suppressReservedKeysWarning: true },
);

const importJobSchema = new Schema<ImportJobSchema>(
  {
    importType: { type: String, enum: importTypes, required: true, index: true },
    status: {
      type: String,
      enum: importJobStatuses,
      default: 'uploaded',
      index: true,
    },
    fileName: String,
    originalName: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    importedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    errors: { type: [issueSchema], default: [] },
    warnings: { type: [issueSchema], default: [] },
    previewRows: { type: [storedRowSchema], default: [] },
    validatedRows: { type: [storedRowSchema], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, suppressReservedKeysWarning: true },
);

importJobSchema.index({ createdAt: -1 });

export type ImportJobDocument = HydratedDocument<ImportJobSchema>;
export const ImportJobModel = mongoose.model<ImportJobSchema>('ImportJob', importJobSchema);
