import { apiRequest } from './apiClient';
import type { ActivityFilters, ActivityListResponse } from '../types/activity';

const queryString = (params: ActivityFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

export const getActivities = (params?: ActivityFilters) =>
  apiRequest<ActivityListResponse>(`/activity${queryString(params)}`);

export const getEntityActivities = (
  entityType: string,
  entityId: string,
  params?: Pick<ActivityFilters, 'page' | 'limit'>,
) =>
  apiRequest<ActivityListResponse>(
    `/activity/entity/${entityType}/${entityId}${queryString(params)}`,
  );

export const getAuditLogs = (params?: ActivityFilters) =>
  apiRequest<ActivityListResponse>(`/activity/audit${queryString(params)}`);
