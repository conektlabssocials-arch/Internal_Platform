import { apiRequest } from './apiClient';
import type {
  ConfirmInventoryPayload,
  InventoryFilters,
  InventoryItem,
  InventoryListResponse,
  InventoryPayload,
  InventorySummaryResponse,
  ReverseGeocodeResponse,
} from '../types/inventory';

type InventoryResponse = {
  data: InventoryItem;
};

const toQueryString = (params: InventoryFilters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

export const getInventory = (params?: InventoryFilters) => {
  return apiRequest<InventoryListResponse>(`/inventory${toQueryString(params)}`);
};

export const getInventorySummary = () => {
  return apiRequest<InventorySummaryResponse>('/inventory/summary');
};

export const getInventoryById = async (id: string) => {
  const response = await apiRequest<InventoryResponse>(`/inventory/${id}`);
  return response.data;
};

export const getInventoryCodePreview = async (params: {
  categoryGroup: string;
  city: string;
  area: string;
}) => {
  const searchParams = new URLSearchParams(params);
  const response = await apiRequest<{ previewCode: string }>(
    `/inventory/preview-code?${searchParams.toString()}`,
  );

  return response.previewCode;
};

export const reverseGeocode = (latitude: number, longitude: number) => {
  const searchParams = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });

  return apiRequest<ReverseGeocodeResponse>(`/geocode/reverse?${searchParams.toString()}`);
};

export const createInventory = async (data: InventoryPayload) => {
  const response = await apiRequest<InventoryResponse>('/inventory', {
    method: 'POST',
    body: data,
  });

  return response.data;
};

export const updateInventory = async (id: string, data: InventoryPayload) => {
  const response = await apiRequest<InventoryResponse>(`/inventory/${id}`, {
    method: 'PATCH',
    body: data,
  });

  return response.data;
};

export const confirmInventory = async (id: string, data: ConfirmInventoryPayload) => {
  const response = await apiRequest<InventoryResponse>(`/inventory/${id}/confirm`, {
    method: 'PATCH',
    body: data,
  });

  return response.data;
};

export const activateInventory = async (id: string) => {
  const response = await apiRequest<InventoryResponse>(`/inventory/${id}/activate`, {
    method: 'PATCH',
  });

  return response.data;
};

export const deactivateInventory = async (id: string) => {
  const response = await apiRequest<InventoryResponse>(`/inventory/${id}/deactivate`, {
    method: 'PATCH',
  });

  return response.data;
};
