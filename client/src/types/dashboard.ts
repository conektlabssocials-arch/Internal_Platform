export type DashboardTask = {
  type: string;
  title: string;
  referenceId: string;
  referenceCode?: string;
  dueAt?: string;
};

export type MyWorkDashboard = {
  myOpenCampaigns: number;
  myFollowUpsDueToday: number;
  myDraftPlans: number;
  mySharedPlans: number;
  myOperationsPending: number;
  myProofPending: number;
  todayTasks: DashboardTask[];
};

export type CampaignDashboard = {
  totalCampaigns: number;
  new: number;
  inDiscussion: number;
  planShared: number;
  negotiating: number;
  won: number;
  lost: number;
  onHold: number;
  openPipelineValue: number;
  wonValue: number;
  lostValue: number;
  followUpsDueToday: number;
  highPriorityOpen: number;
  recentCampaigns: Array<{
    id: string;
    campaignCode: string;
    title: string;
    status: string;
    priority: string;
    value: number;
    nextFollowUpAt?: string;
    createdAt?: string;
  }>;
};

export type PlanDashboard = {
  totalPlans: number;
  draft: number;
  shared: number;
  negotiating: number;
  won: number;
  lost: number;
  totalSharedValue: number;
  totalWonPlanValue: number;
  plansAwaitingResponse: number;
  recentSharedPlans: Array<{
    id: string;
    title: string;
    versionLabel: string;
    status: string;
    grandTotal: number;
    campaignCode?: string;
    campaignTitle?: string;
    sharedAt?: string;
  }>;
  topViewedShares: Array<{
    id: string;
    planId: string;
    campaignId: string;
    planVersionLabel?: string;
    campaignCode?: string;
    clientName?: string;
    viewCount: number;
    lastViewedAt?: string;
    status: string;
    channel?: string;
  }>;
};

export type InventoryDashboard = {
  totalInventory: number;
  activeInventory: number;
  availableInventory: number;
  bookedInventory: number;
  holdInventory: number;
  staleInventory: number;
  neverConfirmedInventory: number;
  freshInventory: number;
  byCategory: Array<{
    categoryGroup: string;
    total: number;
    available: number;
    stale: number;
    neverConfirmed: number;
  }>;
  needsConfirmation: Array<{
    id: string;
    inventoryCode: string;
    title: string;
    categoryGroup: string;
    city: string;
    area: string;
    confirmationStatus: string;
    lastConfirmedAt?: string;
  }>;
};

export type OperationDashboard = {
  totalOperations: number;
  pending: number;
  inProgress: number;
  mounted: number;
  proofPending: number;
  completed: number;
  overdueMountings: number;
  creativePending: number;
  poPending: number;
  recentOperations: Array<{
    id: string;
    operationCode: string;
    campaignCode?: string;
    campaignTitle?: string;
    clientName?: string;
    status: string;
    priority: string;
    progress: number;
    updatedAt?: string;
  }>;
  overdueItems: OperationActionItem[];
  proofPendingItems: OperationActionItem[];
};

export type OperationActionItem = {
  operationId: string;
  operationCode: string;
  campaignTitle?: string;
  itemId: string;
  inventoryCode?: string;
  title?: string;
  city?: string;
  area?: string;
  scheduledDate?: string;
};

export type RecentActivity = {
  type: string;
  title: string;
  createdAt: string;
  referenceType: string;
  referenceId: string;
  referenceCode?: string;
};

export type DashboardOverview = {
  myWork: MyWorkDashboard;
  campaigns: CampaignDashboard;
  plans: PlanDashboard;
  inventory: InventoryDashboard;
  operations: OperationDashboard;
  recentActivity: RecentActivity[];
};
