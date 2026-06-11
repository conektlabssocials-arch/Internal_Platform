import { API_BASE_URL, apiRequest } from './apiClient';
import type {
  ImportCommitResult,
  ImportJob,
  ImportJobFilters,
  ImportTemplate,
  ImportType,
  ImportValidationResult,
} from '../types/import';

type PaginatedJobs = {
  data: ImportJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const queryString = (params: ImportJobFilters) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
};

const download = async (path: string, fallbackName: string) => {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    let message = 'Download failed';
    try {
      message = ((await response.json()) as { message?: string }).message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = match?.[1] || fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const getImportTemplates = async () =>
  (await apiRequest<{ data: ImportTemplate[] }>('/imports/templates')).data;

export const downloadImportTemplate = (templateName: string) =>
  download(`/imports/templates/${templateName}/download`, `${templateName}_template.csv`);

export const uploadImportFile = async (importType: ImportType, file: File) => {
  const body = new FormData();
  body.append('file', file);
  return (
    await apiRequest<{ data: ImportJob }>(`/imports/${importType}/upload`, {
      method: 'POST',
      body,
    })
  ).data;
};

export const validateImportJob = async (jobId: string) =>
  (
    await apiRequest<{ data: ImportValidationResult }>(
      `/imports/jobs/${jobId}/validate`,
      { method: 'POST' },
    )
  ).data;

export const commitImportJob = async (jobId: string) =>
  (
    await apiRequest<{ data: ImportCommitResult }>(
      `/imports/jobs/${jobId}/commit`,
      { method: 'POST' },
    )
  ).data;

export const getImportJobs = (params: ImportJobFilters = {}) =>
  apiRequest<PaginatedJobs>(`/imports/jobs?${queryString(params)}`);

export const getImportJob = async (jobId: string) =>
  (await apiRequest<{ data: ImportJob }>(`/imports/jobs/${jobId}`)).data;

export const downloadImportErrors = (jobId: string) =>
  download(`/imports/jobs/${jobId}/errors.csv`, 'import_errors.csv');

export const deleteImportJob = async (jobId: string) => {
  const response = await fetch(`${API_BASE_URL}/imports/jobs/${jobId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'Unable to cancel import');
  }
};
