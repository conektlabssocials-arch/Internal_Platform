import type {
  CampaignBudgetType,
  CampaignCategory,
  CampaignClientType,
  CampaignDocument,
  CampaignPriority,
  CampaignSource,
  CampaignStatus,
} from '../models/campaign.model.js';

export type CampaignRefDto = {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  phone?: string;
  entityType?: string;
};

export type CampaignOwnerDto = {
  id: string;
  name: string;
  email?: string;
  role?: string;
};

export type CampaignDto = {
  id: string;
  campaignCode: string;
  title: string;
  client: CampaignRefDto;
  clientType: CampaignClientType;
  agencyBrandName?: string;
  source: CampaignSource;
  brief: string;
  objective?: string;
  budgetType: CampaignBudgetType;
  budget?: { min?: number; max?: number; fixed?: number };
  startDate?: Date;
  endDate?: Date;
  geos: string[];
  targetAudience?: string;
  categoriesOfInterest: CampaignCategory[];
  ownerUser: CampaignOwnerDto;
  status: CampaignStatus;
  lostReason?: string;
  onHoldReason?: string;
  expectedRevenue?: number;
  priority: CampaignPriority;
  nextFollowUpAt?: Date;
  notes?: string;
  tags: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type CampaignMutationDto = Partial<
  Omit<CampaignDto, 'id' | 'campaignCode' | 'client' | 'ownerUser' | 'createdAt' | 'updatedAt'>
> & {
  client?: string;
  ownerUser?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type CampaignStatusMutationDto = {
  status?: string;
  reason?: string;
  updatedBy: string;
};

export type CampaignFiltersDto = {
  status?: string;
  client?: string;
  clientType?: string;
  source?: string;
  ownerUser?: string;
  category?: string;
  city?: string;
  geo?: string;
  priority?: string;
  search?: string;
  startDateFrom?: string;
  startDateTo?: string;
  followUpFrom?: string;
  followUpTo?: string;
  followUpDue?: string;
  page?: string;
  limit?: string;
};

const mapRef = (value: any): CampaignRefDto => {
  if (value && typeof value === 'object' && value._id) {
    return {
      id: value._id.toString(),
      name: value.name,
      displayName: value.displayName,
      email: value.email,
      phone: value.phone,
      entityType: value.entityType,
    };
  }
  return { id: value?.toString?.() || '', name: 'Unknown client' };
};

const mapOwner = (value: any): CampaignOwnerDto => {
  if (value && typeof value === 'object' && value._id) {
    return {
      id: value._id.toString(),
      name: value.name,
      email: value.email,
      role: value.role,
    };
  }
  return { id: value?.toString?.() || '', name: 'Unknown owner' };
};

export const mapCampaignToDto = (campaign: CampaignDocument): CampaignDto => ({
  id: campaign._id.toString(),
  campaignCode: campaign.campaignCode,
  title: campaign.title,
  client: mapRef(campaign.client),
  clientType: campaign.clientType,
  agencyBrandName: campaign.agencyBrandName ?? undefined,
  source: campaign.source,
  brief: campaign.brief,
  objective: campaign.objective ?? undefined,
  budgetType: campaign.budgetType,
  budget: campaign.budget
    ? {
        min: campaign.budget.min ?? undefined,
        max: campaign.budget.max ?? undefined,
        fixed: campaign.budget.fixed ?? undefined,
      }
    : undefined,
  startDate: campaign.startDate ?? undefined,
  endDate: campaign.endDate ?? undefined,
  geos: campaign.geos || [],
  targetAudience: campaign.targetAudience ?? undefined,
  categoriesOfInterest: campaign.categoriesOfInterest || [],
  ownerUser: mapOwner(campaign.ownerUser),
  status: campaign.status,
  lostReason: campaign.lostReason ?? undefined,
  onHoldReason: campaign.onHoldReason ?? undefined,
  expectedRevenue: campaign.expectedRevenue ?? undefined,
  priority: campaign.priority,
  nextFollowUpAt: campaign.nextFollowUpAt ?? undefined,
  notes: campaign.notes ?? undefined,
  tags: campaign.tags || [],
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt,
});
