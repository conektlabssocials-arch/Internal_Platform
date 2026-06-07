import { API_BASE_URL, apiRequest } from './apiClient';
import type {
  CreateSharePayload,
  PlanShare,
  PublicSharedPlan,
} from '../types/share';

export const createPlanShare = async (planId: string, data: CreateSharePayload) =>
  (
    await apiRequest<{ share: PlanShare; shareUrl: string }>(`/shares/plans/${planId}`, {
      method: 'POST',
      body: data,
    })
  ).share;

export const getPlanShares = async (planId: string) =>
  (await apiRequest<{ data: PlanShare[] }>(`/shares/plans/${planId}`)).data;

export const disableShare = async (shareId: string) =>
  (
    await apiRequest<{ data: PlanShare }>(`/shares/${shareId}/disable`, {
      method: 'PATCH',
    })
  ).data;

export class PublicShareError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export const getPublicShare = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/public/shares/${token}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new PublicShareError(body.message || 'Share link could not be opened', response.status);
  }
  return ((await response.json()) as { data: PublicSharedPlan }).data;
};

export const trackPublicShareEvent = async (
  token: string,
  payload:
    | { eventType: 'map_opened' }
    | { eventType: 'pin_clicked'; inventoryCode?: string; title?: string },
) => {
  const response = await fetch(`${API_BASE_URL}/public/shares/${token}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new PublicShareError(body.message || 'Failed to track map interaction', response.status);
  }
};
