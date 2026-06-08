import { API_BASE_URL, apiRequest } from './apiClient';
import type {
  DocumentRecord,
  OperationDocument,
  OperationDocumentType,
  PlanDocument,
  PlanDocumentType,
} from '../types/document';

export const generatePlanDocument = async (
  planId: string,
  documentType: PlanDocumentType,
) =>
  (
    await apiRequest<{ data: PlanDocument }>(`/documents/plans/${planId}/generate`, {
      method: 'POST',
      body: { documentType },
    })
  ).data;

export const getPlanDocuments = async (planId: string) =>
  (await apiRequest<{ data: PlanDocument[] }>(`/documents/plans/${planId}`)).data;

export const generateOperationDocument = async (
  operationId: string,
  documentType: OperationDocumentType,
) =>
  (
    await apiRequest<{ data: OperationDocument }>(
      `/documents/operations/${operationId}/generate`,
      {
        method: 'POST',
        body: { documentType },
      },
    )
  ).data;

export const getOperationDocuments = async (operationId: string) =>
  (
    await apiRequest<{ data: OperationDocument[] }>(
      `/documents/operations/${operationId}`,
    )
  ).data;

export const downloadDocument = async (
  document: Pick<DocumentRecord, 'id' | 'fileName'>,
) => {
  const response = await fetch(`${API_BASE_URL}/documents/${document.id}/download`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to download document');

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = document.fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};
