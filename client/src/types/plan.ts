export type PlanStatus = 'Draft' | 'Shared' | 'Negotiating' | 'Won' | 'Lost';

export type PlanItem = {
  inventory: string;
  inventoryCode: string;
  title: string;
  categoryGroup?: string;
  subCategory?: string;
  city?: string;
  area?: string;
  width?: number;
  height?: number;
  totalSqFt?: number;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  photos: string[];
  route?: string;
  depot?: string;
  itinerary?: string;
  screenSize?: string;
  numberOfScreens?: number;
  numberOfVehicles?: number;
  households?: number;
  approxReach?: number;
  monthlyImpressions?: number;
  buildingAge?: number;
  startDate?: string;
  endDate?: string;
  durationDays: number;
  quantity: number;
  unitSellingPrice: number;
  totalSellingPrice: number;
  unitInternalCost: number;
  totalInternalCost: number;
  marginAmount: number;
  marginPercentage: number;
  notes?: string;
};

export type PlanPricing = {
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  grandTotal: number;
  internalCostTotal: number;
  marginAmount: number;
  marginPercentage: number;
};

export type Plan = {
  id: string;
  campaign: {
    id: string;
    name: string;
    campaignCode?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    client?: { id: string; name: string };
  };
  versionNumber: number;
  versionLabel: string;
  title: string;
  status: PlanStatus;
  isLocked: boolean;
  items: PlanItem[];
  pricing: PlanPricing;
  clientNotes?: string;
  internalNotes?: string;
  clonedFromPlan?: string;
  sharedAt?: string;
  wonAt?: string;
  lostAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PlanItemPayload = {
  inventory: string;
  startDate?: string;
  endDate?: string;
  quantity?: number;
  unitSellingPrice?: number;
  unitInternalCost?: number;
  notes?: string;
};

export type PlanPayload = {
  title?: string;
  items?: PlanItemPayload[];
  taxPercentage?: number;
  clientNotes?: string;
  internalNotes?: string;
};
