export type CampaignClientType = 'Brand' | 'Agency' | 'Individual';
export type CampaignSource = 'Call' | 'WhatsApp' | 'Email' | 'Referral' | 'Walk-in' | 'Website' | 'Other';
export type CampaignBudgetType = 'fixed' | 'range' | 'unknown';
export type CampaignStatus = 'New' | 'In Discussion' | 'Plan Shared' | 'Negotiating' | 'Won' | 'Lost' | 'On Hold';
export type CampaignPriority = 'Low' | 'Medium' | 'High';
export type CampaignCategory = 'Outdoor' | 'Auto' | 'Bus' | 'Mobile Van';

export type CampaignClient = {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  phone?: string;
  entityType?: string;
};

export type CampaignOwner = {
  id: string;
  name: string;
  email?: string;
  role?: string;
};

export type Campaign = {
  id: string;
  campaignCode: string;
  title: string;
  client: CampaignClient;
  clientType: CampaignClientType;
  agencyBrandName?: string;
  source: CampaignSource;
  brief: string;
  objective?: string;
  budgetType: CampaignBudgetType;
  budget?: { min?: number; max?: number; fixed?: number };
  startDate?: string;
  endDate?: string;
  geos: string[];
  targetAudience?: string;
  categoriesOfInterest: CampaignCategory[];
  ownerUser: CampaignOwner;
  status: CampaignStatus;
  lostReason?: string;
  onHoldReason?: string;
  expectedRevenue?: number;
  priority: CampaignPriority;
  nextFollowUpAt?: string;
  notes?: string;
  tags: string[];
};

export type CampaignPayload = Partial<
  Omit<Campaign, 'id' | 'campaignCode' | 'client' | 'ownerUser' | 'status'>
> & {
  client?: string;
  ownerUser?: string;
};

export type CampaignFilters = {
  status?: string;
  client?: string;
  clientType?: string;
  source?: string;
  ownerUser?: string;
  category?: string;
  priority?: string;
  search?: string;
  followUpDue?: string;
  page?: number;
  limit?: number;
};

export type CampaignSummary = {
  total: number;
  new: number;
  inDiscussion: number;
  planShared: number;
  negotiating: number;
  won: number;
  lost: number;
  onHold: number;
  openPipelineValue: number;
  wonValue: number;
  followUpsDueToday: number;
};

export type CampaignClientSearchItem = {
  id: string;
  name: string;
  entityType: CampaignClientType;
  email?: string;
  phone?: string;
};
