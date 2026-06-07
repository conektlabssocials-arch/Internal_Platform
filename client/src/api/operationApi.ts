import { apiRequest } from './apiClient';
import type {
  Operation,
  OperationFilters,
  OperationSummary,
  PaginatedOperations,
} from '../types/operation';

const query = (params: OperationFilters = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== false) {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.size ? `?${searchParams.toString()}` : '';
};

export const getOperations = (params?: OperationFilters) =>
  apiRequest<PaginatedOperations>(`/operations${query(params)}`);

export const getOperationSummary = async () =>
  (await apiRequest<{ data: OperationSummary }>('/operations/summary')).data;

export const getOperationById = async (id: string) =>
  (await apiRequest<{ data: Operation }>(`/operations/${id}`)).data;

export const getOperationByPlan = async (planId: string) =>
  (await apiRequest<{ data: Operation }>(`/operations/by-plan/${planId}`)).data;

export const syncOperationFromPlan = async (planId: string) =>
  (
    await apiRequest<{ data: Operation }>(`/operations/sync-from-plan/${planId}`, {
      method: 'POST',
    })
  ).data;

export const updateOperation = async (id: string, data: Record<string, unknown>) =>
  (
    await apiRequest<{ data: Operation }>(`/operations/${id}`, {
      method: 'PATCH',
      body: data,
    })
  ).data;

export const updateOperationStatus = async (id: string, status: string) =>
  (
    await apiRequest<{ data: Operation }>(`/operations/${id}/status`, {
      method: 'PATCH',
      body: { status },
    })
  ).data;

const updateItemPath = (
  operationId: string,
  itemId: string,
  suffix: string,
  data: Record<string, unknown>,
) =>
  apiRequest<{ data: Operation }>(
    `/operations/${operationId}/items/${itemId}${suffix}`,
    { method: 'PATCH', body: data },
  ).then((response) => response.data);

export const updateOperationItem = (
  operationId: string,
  itemId: string,
  data: Record<string, unknown>,
) => updateItemPath(operationId, itemId, '', data);

export const updateCreative = (
  operationId: string,
  itemId: string,
  data: Record<string, unknown>,
) => updateItemPath(operationId, itemId, '/creative', data);

export const updatePO = (
  operationId: string,
  itemId: string,
  data: Record<string, unknown>,
) => updateItemPath(operationId, itemId, '/po', data);

export const updateMounting = (
  operationId: string,
  itemId: string,
  data: Record<string, unknown>,
) => updateItemPath(operationId, itemId, '/mounting', data);

export const updateProof = (
  operationId: string,
  itemId: string,
  data: Record<string, unknown>,
) => updateItemPath(operationId, itemId, '/proof', data);

export const updateTakedown = (
  operationId: string,
  itemId: string,
  data: Record<string, unknown>,
) => updateItemPath(operationId, itemId, '/takedown', data);
