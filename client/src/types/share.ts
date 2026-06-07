export type ShareChannel = 'WhatsApp' | 'Email' | 'Phone' | 'Other';
export type ShareStatus = 'active' | 'disabled' | 'expired';

export type PlanShare = {
  id: string;
  plan: string;
  campaign: string;
  status: ShareStatus;
  expiresAt?: string;
  createdBy?: {
    id: string;
    name: string;
    email?: string;
  };
  createdAt: string;
  lastViewedAt?: string;
  viewCount: number;
  mapOpenedCount: number;
  pinClickCount: number;
  lastMapInteractionAt?: string;
  sharedWithName?: string;
  sharedWithEmail?: string;
  sharedWithPhone?: string;
  channel: ShareChannel;
  shareUrl: string;
};

export type CreateSharePayload = {
  expiresAt?: string;
  sharedWithName?: string;
  sharedWithEmail?: string;
  sharedWithPhone?: string;
  channel: ShareChannel;
};

export type PublicSharedPlan = {
  share: {
    status: ShareStatus;
    expiresAt?: string;
    viewCount: number;
  };
  campaign: {
    title: string;
    clientName: string;
    brief?: string;
  };
  plan: {
    versionLabel: string;
    status: string;
    clientNotes?: string;
    items: Array<{
      title: string;
      categoryGroup?: string;
      subCategory?: string;
      city?: string;
      area?: string;
      width?: number;
      height?: number;
      totalSqFt?: number;
      startDate?: string;
      endDate?: string;
      quantity: number;
      unitSellingPrice: number;
      totalSellingPrice: number;
      notes?: string;
    }>;
    pricing: {
      subtotal: number;
      taxPercentage: number;
      taxAmount: number;
      grandTotal: number;
    };
  };
  mapItems: PlanMapItem[];
  nonMapItems: NonMapPlanItem[];
};

export type PlanMapItem = {
  planItemId: string;
  inventoryCode?: string;
  title?: string;
  categoryGroup?: string;
  subCategory?: string;
  city?: string;
  area?: string;
  address?: string;
  latitude: number;
  longitude: number;
  width?: number;
  height?: number;
  totalSqFt?: number;
  startDate?: string;
  endDate?: string;
  quantity: number;
  unitSellingPrice: number;
  totalSellingPrice: number;
  photoUrl?: string;
};

export type NonMapPlanItem = Omit<
  PlanMapItem,
  'address' | 'latitude' | 'longitude' | 'photoUrl'
> & {
  route?: string;
  depot?: string;
  itinerary?: string;
  notes?: string;
};

export type PlanMapData = {
  mapItems: PlanMapItem[];
  nonMapItems: NonMapPlanItem[];
};
