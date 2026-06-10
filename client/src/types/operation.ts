export type OperationStatus =
  | 'Pending'
  | 'In Progress'
  | 'Partially Mounted'
  | 'Mounted'
  | 'Proof Pending'
  | 'Completed'
  | 'On Hold'
  | 'Cancelled';

export type OperationItemStatus =
  | 'Pending'
  | 'Creative Pending'
  | 'PO Pending'
  | 'Mounting Scheduled'
  | 'Mounted'
  | 'Proof Uploaded'
  | 'Completed'
  | 'On Hold'
  | 'Cancelled';

export type OperationPriority = 'Low' | 'Medium' | 'High';

export type OperationItem = {
  id: string;
  planItemId: string;
  inventory?: string;
  inventoryCode?: string;
  title?: string;
  categoryGroup?: string;
  subCategory?: string;
  city?: string;
  area?: string;
  location?: { address?: string; latitude?: number; longitude?: number };
  route?: string;
  depot?: string;
  itinerary?: string;
  width?: number;
  height?: number;
  totalSqFt?: number;
  campaignStartDate?: string;
  campaignEndDate?: string;
  unitSellingPrice?: number;
  totalSellingPrice?: number;
  unitInternalCost?: number;
  totalInternalCost?: number;
  supplierName?: string;
  ownerName?: string;
  creative: {
    required: boolean;
    received: boolean;
    receivedAt?: string;
    fileUrls: string[];
    fileUploads: string[];
    notes?: string;
  };
  purchaseOrder: {
    required: boolean;
    sent: boolean;
    sentAt?: string;
    poNumber?: string;
    poFileUrl?: string;
    fileUploads: string[];
    notes?: string;
  };
  mounting: {
    scheduledDate?: string;
    completed: boolean;
    completedAt?: string;
    vendorNotes?: string;
    internalNotes?: string;
  };
  proof: {
    uploaded: boolean;
    uploadedAt?: string;
    photoUrls: string[];
    fileUploads: string[];
    notes?: string;
  };
  takedown: {
    required: boolean;
    scheduledDate?: string;
    completed: boolean;
    completedAt?: string;
    notes?: string;
  };
  itemStatus: OperationItemStatus;
  notes?: string;
};

export type Operation = {
  id: string;
  operationCode: string;
  campaign: string;
  plan: string;
  client?: string;
  planVersionLabel?: string;
  campaignCode?: string;
  campaignTitle?: string;
  clientName?: string;
  operationOwner?: { id: string; name: string; email?: string };
  status: OperationStatus;
  priority: OperationPriority;
  items: OperationItem[];
  overallProgress: {
    totalItems: number;
    creativeReceivedCount: number;
    poSentCount: number;
    mountingCompletedCount: number;
    proofUploadedCount: number;
    completedItemCount: number;
    percentage: number;
  };
  importantDates: {
    firstMountingDate?: string;
    lastMountingDate?: string;
    firstTakedownDate?: string;
    lastTakedownDate?: string;
  };
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type OperationSummary = {
  total: number;
  pending: number;
  inProgress: number;
  mounted: number;
  proofPending: number;
  completed: number;
  overdueMountings: number;
  proofPendingCount: number;
  creativePendingCount: number;
  poPendingCount: number;
};

export type OperationFilters = {
  search?: string;
  status?: string;
  city?: string;
  categoryGroup?: string;
  operationOwner?: string;
  priority?: string;
  mountingFrom?: string;
  mountingTo?: string;
  proofPending?: boolean;
  overdue?: boolean;
  page?: number;
  limit?: number;
};

export type PaginatedOperations = {
  data: Operation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
