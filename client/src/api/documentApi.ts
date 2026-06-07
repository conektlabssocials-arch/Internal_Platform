import { API_BASE_URL, apiRequest } from './apiClient';
import type { DocumentType, PlanDocument } from '../types/document';

export const generatePlanDocument = async (
  planId: string,
  documentType: DocumentType,
) =>
  (
    await apiRequest<{ data: PlanDocument }>(`/documents/plans/${planId}/generate`, {
      method: 'POST',
      body: { documentType },
    })
  ).data;

export const getPlanDocuments = async (planId: string) =>
  (await apiRequest<{ data: PlanDocument[] }>(`/documents/plans/${planId}`)).data;

export const downloadDocument = async (document: PlanDocument) => {
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
