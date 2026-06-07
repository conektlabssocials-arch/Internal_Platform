import { apiRequest } from './apiClient';
import type {
  Campaign,
  CampaignFilters,
  CampaignPayload,
  CampaignStatus,
  CampaignSummary,
} from '../types/campaign';

const query = (params: Record<string, unknown> = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value));
  });
  return searchParams.size ? `?${searchParams}` : '';
};

export const getCampaigns = (params: CampaignFilters = {}) =>
  apiRequest<{
    data: Campaign[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/campaigns${query(params)}`);

export const getCampaignSummary = async () =>
  (await apiRequest<{ data: CampaignSummary }>('/campaigns/summary')).data;

export const getCampaignById = async (id: string) =>
  (await apiRequest<{ data: Campaign }>(`/campaigns/${id}`)).data;

export const previewCampaignCode = async () =>
  (await apiRequest<{ previewCode: string }>('/campaigns/preview-code')).previewCode;

export const createCampaign = async (data: CampaignPayload) =>
  (await apiRequest<{ data: Campaign }>('/campaigns', { method: 'POST', body: data })).data;

export const updateCampaign = async (id: string, data: CampaignPayload) =>
  (await apiRequest<{ data: Campaign }>(`/campaigns/${id}`, { method: 'PATCH', body: data })).data;

export const updateCampaignStatus = async (
  id: string,
  data: { status: CampaignStatus; reason?: string },
) =>
  (
    await apiRequest<{ data: Campaign }>(`/campaigns/${id}/status`, {
      method: 'PATCH',
      body: data,
    })
  ).data;
