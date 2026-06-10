import { API_BASE_URL, apiRequest } from './apiClient';
import type { Operation } from '../types/operation';
import type { UploadCategory, UploadedFile } from '../types/upload';

const formData = (files: File[]) => {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));
  return data;
};

const uploadFiles = <T>(path: string, files: File[]) =>
  apiRequest<{ data: T }>(path, {
    method: 'POST',
    body: formData(files),
  }).then((response) => response.data);

export const uploadInventoryPhotos = (inventoryId: string, files: File[]) =>
  uploadFiles<UploadedFile[]>(`/uploads/inventory/${inventoryId}/photos`, files);

const uploadOperationFiles = (
  operationId: string,
  itemId: string,
  suffix: 'creative' | 'po' | 'proof',
  files: File[],
) =>
  uploadFiles<{ uploads: UploadedFile[]; operation: Operation }>(
    `/uploads/operations/${operationId}/items/${itemId}/${suffix}`,
    files,
  );

export const uploadOperationCreative = (
  operationId: string,
  itemId: string,
  files: File[],
) => uploadOperationFiles(operationId, itemId, 'creative', files);

export const uploadOperationPO = (
  operationId: string,
  itemId: string,
  files: File[],
) => uploadOperationFiles(operationId, itemId, 'po', files);

export const uploadOperationProof = (
  operationId: string,
  itemId: string,
  files: File[],
) => uploadOperationFiles(operationId, itemId, 'proof', files);

export const getUploads = async (filters: {
  entityType?: string;
  entityId?: string;
  category?: UploadCategory;
  itemId?: string;
}) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return (
    await apiRequest<{ data: UploadedFile[] }>(
      `/uploads${query.size ? `?${query.toString()}` : ''}`,
    )
  ).data;
};

export const deleteUpload = (uploadId: string) =>
  apiRequest<{ message: string }>(`/uploads/${uploadId}`, { method: 'DELETE' });

export const getUploadDownloadUrl = (uploadId: string) =>
  `${API_BASE_URL}/uploads/${uploadId}/download`;

export const getPublicUploadUrl = (uploadId: string) =>
  `${API_BASE_URL}/public/uploads/${uploadId}`;
