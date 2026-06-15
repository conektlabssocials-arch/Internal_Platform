export type ImportType = 'inventory' | 'crm_entities' | 'contacts';
export type ImportJobStatus =
  | 'uploaded'
  | 'validated'
  | 'imported'
  | 'failed'
  | 'cancelled';
export type ImportRowStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'duplicate'
  | 'imported'
  | 'skipped';

export type ImportIssue = {
  rowNumber: number;
  field: string;
  message: string;
  value?: string;
};

export type ImportRow = {
  rowNumber: number;
  status: ImportRowStatus;
  data: Record<string, unknown>;
  errors?: ImportIssue[];
  warnings?: ImportIssue[];
};

export type ImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  warnings: number;
};

export type ImportJob = ImportSummary & {
  id: string;
  importType: ImportType;
  status: ImportJobStatus;
  fileName?: string;
  originalName?: string;
  uploadedBy?: { id?: string; name?: string; email?: string };
  errors?: ImportIssue[];
  previewRows?: ImportRow[];
  createdAt: string;
  updatedAt: string;
};

export type ImportTemplate = {
  name: string;
  fileName: string;
  importType: ImportType;
  description: string;
};

export type ImportValidationResult = {
  job: ImportJob;
  summary: ImportSummary;
  previewRows: ImportRow[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export type ImportCommitResult = {
  job: ImportJob;
  summary: ImportSummary;
};

export type ImportJobFilters = {
  importType?: ImportType | '';
  status?: ImportJobStatus | '';
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};
