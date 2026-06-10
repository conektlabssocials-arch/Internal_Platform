export type UploadCategory =
  | 'inventory_photo'
  | 'creative'
  | 'purchase_order'
  | 'proof'
  | 'document'
  | 'other';

export type UploadedFile = {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: UploadCategory;
  entityType: string;
  entityId?: string;
  isPublicSafe: boolean;
  status: string;
  url: string;
  publicUrl?: string;
  providerUrl?: string;
  uploadedBy?: { id: string; name?: string; email?: string };
  metadata: Record<string, unknown>;
  createdAt?: string;
};
