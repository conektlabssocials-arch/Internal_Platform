import { apiRequest } from './apiClient';
import type {
  CampaignDashboard,
  DashboardOverview,
  InventoryDashboard,
  MyWorkDashboard,
  OperationDashboard,
  PlanDashboard,
} from '../types/dashboard';

const getData = async <T>(path: string) =>
  (await apiRequest<{ data: T }>(path)).data;

export const getDashboardOverview = () =>
  getData<DashboardOverview>('/dashboard/overview');

export const getMyWork = () =>
  getData<MyWorkDashboard>('/dashboard/my-work');

export const getCampaignDashboard = () =>
  getData<CampaignDashboard>('/dashboard/campaigns');

export const getPlanDashboard = () =>
  getData<PlanDashboard>('/dashboard/plans');

export const getInventoryDashboard = () =>
  getData<InventoryDashboard>('/dashboard/inventory');

export const getOperationsDashboard = () =>
  getData<OperationDashboard>('/dashboard/operations');
