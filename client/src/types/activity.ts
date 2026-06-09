export type ActivityChange = {
  field: string;
  from: unknown;
  to: unknown;
};

export type ActivityLog = {
  id: string;
  actor?: string;
  actorName: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId?: string;
  entityCode?: string;
  entityTitle?: string;
  parentEntityType?: string;
  parentEntityId?: string;
  parentEntityCode?: string;
  message: string;
  changes: ActivityChange[];
  metadata: Record<string, unknown>;
  visibility: 'internal' | 'admin_only';
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
};

export type ActivityFilters = {
  entityType?: string;
  action?: string;
  actor?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type ActivityListResponse = {
  data: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
