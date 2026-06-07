import { apiRequest } from './apiClient';
import type { Plan, PlanPayload, PlanStatus } from '../types/plan';

export const getPlansByCampaign = async (campaignId: string) =>
  (await apiRequest<{ data: Plan[] }>(`/campaigns/${campaignId}/plans`)).data;

export const getRecentPlans = async () =>
  (await apiRequest<{ data: Plan[] }>('/plans')).data;

export const createPlan = async (campaignId: string, data: PlanPayload = {}) =>
  (
    await apiRequest<{ data: Plan }>(`/campaigns/${campaignId}/plans`, {
      method: 'POST',
      body: data,
    })
  ).data;

export const clonePlan = async (planId: string) =>
  (await apiRequest<{ data: Plan }>(`/plans/${planId}/clone`, { method: 'POST' })).data;

export const getPlanById = async (planId: string) =>
  (await apiRequest<{ data: Plan }>(`/plans/${planId}`)).data;

export const updatePlan = async (planId: string, data: PlanPayload) =>
  (
    await apiRequest<{ data: Plan }>(`/plans/${planId}`, {
      method: 'PATCH',
      body: data,
    })
  ).data;

export const updatePlanStatus = async (planId: string, status: PlanStatus) =>
  (
    await apiRequest<{ data: Plan }>(`/plans/${planId}/status`, {
      method: 'PATCH',
      body: { status },
    })
  ).data;

export const deletePlan = (planId: string) =>
  apiRequest<{ message: string }>(`/plans/${planId}`, { method: 'DELETE' });
