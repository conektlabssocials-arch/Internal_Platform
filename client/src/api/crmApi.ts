import { apiRequest } from './apiClient';
import type {
  Contact,
  ContactPayload,
  CrmEntity,
  CrmEntityPayload,
  CrmFilters,
  CrmListResponse,
  CrmSummaryItem,
  SupplierSearchItem,
} from '../types/crm';

const toQueryString = (params: Record<string, unknown> = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const getCrmEntities = (params: CrmFilters = {}) =>
  apiRequest<CrmListResponse>(`/crm/entities${toQueryString(params)}`);

export const getCrmSummary = async () => {
  const response = await apiRequest<{ data: CrmSummaryItem[] }>('/crm/summary');
  return response.data;
};

export const getCrmEntityById = async (id: string) => {
  const response = await apiRequest<{ data: CrmEntity }>(`/crm/entities/${id}`);
  return response.data;
};

export const createCrmEntity = async (data: CrmEntityPayload) => {
  const response = await apiRequest<{ data: CrmEntity }>('/crm/entities', {
    method: 'POST',
    body: data,
  });
  return response.data;
};

export const updateCrmEntity = async (id: string, data: CrmEntityPayload) => {
  const response = await apiRequest<{ data: CrmEntity }>(`/crm/entities/${id}`, {
    method: 'PATCH',
    body: data,
  });
  return response.data;
};

const patchEntityStatus = async (id: string, action: 'activate' | 'deactivate') => {
  const response = await apiRequest<{ data: CrmEntity }>(`/crm/entities/${id}/${action}`, {
    method: 'PATCH',
  });
  return response.data;
};

export const activateCrmEntity = (id: string) => patchEntityStatus(id, 'activate');
export const deactivateCrmEntity = (id: string) => patchEntityStatus(id, 'deactivate');

export const getContacts = async (entityId: string) => {
  const response = await apiRequest<{ data: Contact[] }>(
    `/crm/entities/${entityId}/contacts`,
  );
  return response.data;
};

export const createContact = async (entityId: string, data: ContactPayload) => {
  const response = await apiRequest<{ data: Contact }>(
    `/crm/entities/${entityId}/contacts`,
    { method: 'POST', body: data },
  );
  return response.data;
};

export const updateContact = async (contactId: string, data: ContactPayload) => {
  const response = await apiRequest<{ data: Contact }>(`/crm/contacts/${contactId}`, {
    method: 'PATCH',
    body: data,
  });
  return response.data;
};

const patchContactStatus = async (contactId: string, action: 'activate' | 'deactivate') => {
  const response = await apiRequest<{ data: Contact }>(
    `/crm/contacts/${contactId}/${action}`,
    { method: 'PATCH' },
  );
  return response.data;
};

export const activateContact = (contactId: string) =>
  patchContactStatus(contactId, 'activate');
export const deactivateContact = (contactId: string) =>
  patchContactStatus(contactId, 'deactivate');

export const deleteContact = (contactId: string) =>
  apiRequest<{ message: string }>(`/crm/contacts/${contactId}`, { method: 'DELETE' });

export const searchSuppliers = async (search = '') => {
  const response = await apiRequest<{ data: SupplierSearchItem[] }>(
    `/crm/suppliers/search${toQueryString({ search })}`,
  );
  return response.data;
};
