export type CategoryGroup = 'Outdoor' | 'Auto' | 'Bus' | 'Mobile Van';
export type AvailabilityStatus = 'available' | 'booked' | 'hold' | 'unknown';
export type InventoryStatus = 'active' | 'inactive';
export type ConfirmationStatus = 'fresh' | 'stale' | 'never_confirmed';
export type IlluminationType = 'Lit' | 'Non-lit' | 'Backlit' | 'Frontlit' | 'NA';

export type InventoryItem = {
  id: string;
  inventoryCode: string;
  categoryGroup: CategoryGroup;
  subCategory: string;
  title: string;
  city: string;
  area: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    source?: 'manual' | 'map_picker' | 'reverse_geocode';
  };
  photos: string[];
  ownerName?: string;
  ownerPhone?: string;
  supplierName?: string;
  internalCost?: number;
  sellingPrice?: number;
  minSpend?: number;
  minDurationDays?: number;
  availabilityStatus: AvailabilityStatus;
  status: InventoryStatus;
  tags: string[];
  internalNotes?: string;
  lastConfirmedAt?: string;
  confirmationNote?: string;
  confirmationStatus: ConfirmationStatus;
  width?: number;
  height?: number;
  totalSqFt?: number;
  illumination?: IlluminationType;
  facingDirection?: string;
  trafficDirection?: string;
  estimatedTraffic?: string;
  loopLengthSeconds?: number;
  spotsPerHour?: number;
  screenSpecs?: string;
  numberOfVehicles?: number;
  route?: string;
  depot?: string;
  brandingType?: string;
  ratePerVehiclePerMonth?: number;
  operatorName?: string;
  itinerary?: string;
  operationDays?: number;
  hasLedScreen?: boolean;
  hasAudioSystem?: boolean;
  hasCanopy?: boolean;
  ratePerDay?: number;
};

export type InventoryFilters = {
  search?: string;
  categoryGroup?: string;
  subCategory?: string;
  city?: string;
  area?: string;
  status?: string;
  availabilityStatus?: string;
  confirmationStatus?: string;
  page?: number;
  limit?: number;
};

export type InventoryPayload = Partial<Omit<InventoryItem, 'id' | 'confirmationStatus'>> & {
  inventoryCode?: never;
};

export type ConfirmInventoryPayload = {
  confirmationNote?: string;
  availabilityStatus?: AvailabilityStatus;
  internalCost?: number;
  sellingPrice?: number;
};

export type InventorySummaryItem = {
  categoryGroup: CategoryGroup;
  total: number;
  available: number;
  stale: number;
  neverConfirmed: number;
};

export type InventoryListResponse = {
  data: InventoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type InventorySummaryResponse = {
  data: InventorySummaryItem[];
};

export type ReverseGeocodeResponse = {
  address?: string;
  city?: string;
  area?: string;
  raw?: unknown;
};
