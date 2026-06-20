import type {
  AvailabilityStatus,
  CategoryGroup,
  ConfirmationStatus,
  IlluminationType,
  InventoryDocument,
  InventoryStatus,
  InventorySubCategory,
} from '../models/inventory.model.js';

export type DimensionPanelDto = {
  label?: string;
  width?: number;
  height?: number;
  unit?: string;
};

export type GuideLinkDto = {
  label?: string;
  url?: string;
};

export type InventoryDto = {
  id: string;
  inventoryCode: string;
  categoryGroup: CategoryGroup;
  subCategory: InventorySubCategory;
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
  photoUploads: string[];
  ownerName?: string;
  ownerPhone?: string;
  supplierName?: string;
  ownerEntity?: string;
  supplierEntity?: string;
  internalCost?: number;
  sellingPrice?: number;
  minSpend?: number;
  minDurationDays?: number;
  availabilityStatus: AvailabilityStatus;
  status: InventoryStatus;
  tags: string[];
  internalNotes?: string;
  lastConfirmedAt?: Date;
  confirmedBy?: string;
  confirmationNote?: string;
  confirmationStatus: ConfirmationStatus;
  width?: number;
  height?: number;
  totalSqFt?: number;
  dimensionPanels?: DimensionPanelDto[];
  guideLinks?: GuideLinkDto[];
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
  propertyName?: string;
  phase?: string;
  profile?: string;
  pinCode?: string;
  propertyPriceUptoCr?: number;
  screenSize?: string;
  propertyVisualLink?: string;
  numberOfScreens?: number;
  households?: number;
  approxReach?: number;
  monthlyImpressions?: number;
  monthlyAdBudget?: number;
  discountedMonthlyAdBudget?: number;
  mediaSiteId?: string;
  buildingAge?: number;
  propertyType?: string;
  nccsClass?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type InventoryFiltersDto = {
  categoryGroup?: string;
  subCategory?: string;
  city?: string;
  area?: string;
  status?: string;
  availabilityStatus?: string;
  confirmationStatus?: string;
  search?: string;
  page?: string;
  limit?: string;
};

export type InventoryMutationDto = Partial<
  Omit<InventoryDto, 'id' | 'createdAt' | 'updatedAt' | 'ownerEntity' | 'supplierEntity'>
> & {
  ownerEntity?: string | null;
  supplierEntity?: string | null;
  createdBy?: string;
  updatedBy?: string;
};

export type ConfirmInventoryDto = {
  confirmationNote?: string;
  availabilityStatus?: AvailabilityStatus;
  internalCost?: number;
  sellingPrice?: number;
  confirmedBy: string;
};

export type InventorySummaryDto = {
  categoryGroup: CategoryGroup;
  total: number;
  available: number;
  stale: number;
  neverConfirmed: number;
};

const idToString = (value: unknown) => {
  if (!value) {
    return undefined;
  }

  return value.toString();
};

const legacyCategoryGroupMap: Record<string, CategoryGroup> = {
  OOH: 'Outdoor',
  DOOH: 'Outdoor',
  Auto: 'Auto',
  Bus: 'Bus',
  'Mobile Van': 'Mobile Van',
  'A3 Screens': 'A3 Screens',
};

const legacySubCategoryMap: Record<string, InventorySubCategory> = {
  OOH: 'Hoarding',
  DOOH: 'Digital OOH',
  Auto: 'Auto Hood',
  Bus: 'Bus Panel',
  'Mobile Van': 'Hoarding',
  'A3 Screens': 'Residential',
};

export const getEffectiveCategoryGroup = (item: InventoryDocument) => {
  return item.categoryGroup || legacyCategoryGroupMap[item.category || ''];
};

export const getEffectiveSubCategory = (item: InventoryDocument) => {
  return item.subCategory || legacySubCategoryMap[item.category || ''] || item.subType;
};

export const mapInventoryToDto = (
  item: InventoryDocument,
  confirmationStatus: ConfirmationStatus,
): InventoryDto => ({
  id: item._id.toString(),
  inventoryCode: item.inventoryCode,
  categoryGroup: getEffectiveCategoryGroup(item),
  subCategory: getEffectiveSubCategory(item) as InventorySubCategory,
  title: item.title,
  city: item.city,
  area: item.area,
  location: item.location
    ? {
        latitude: item.location.latitude ?? undefined,
        longitude: item.location.longitude ?? undefined,
        address: item.location.address ?? undefined,
        source: item.location.source ?? undefined,
      }
    : undefined,
  photos: item.photos || [],
  photoUploads: (item.photoUploads || []).map((upload) => upload.toString()),
  ownerName: item.ownerName ?? undefined,
  ownerPhone: item.ownerPhone ?? undefined,
  supplierName: item.supplierName ?? undefined,
  ownerEntity: idToString(item.ownerEntity),
  supplierEntity: idToString(item.supplierEntity),
  internalCost: item.internalCost ?? undefined,
  sellingPrice: item.sellingPrice ?? undefined,
  minSpend: item.minSpend ?? undefined,
  minDurationDays: item.minDurationDays ?? undefined,
  availabilityStatus: item.availabilityStatus,
  status: item.status,
  tags: item.tags || [],
  internalNotes: item.internalNotes ?? undefined,
  lastConfirmedAt: item.lastConfirmedAt ?? undefined,
  confirmedBy: idToString(item.confirmedBy),
  confirmationNote: item.confirmationNote ?? undefined,
  confirmationStatus,
  width: item.width ?? undefined,
  height: item.height ?? undefined,
  totalSqFt: item.totalSqFt ?? undefined,
  dimensionPanels: (item.dimensionPanels || []).map((panel) => ({
    label: panel.label ?? undefined,
    width: panel.width ?? undefined,
    height: panel.height ?? undefined,
    unit: panel.unit ?? undefined,
  })),
  guideLinks: (item.guideLinks || []).map((link) => ({
    label: link.label ?? undefined,
    url: link.url ?? undefined,
  })),
  illumination: item.illumination ?? undefined,
  facingDirection: item.facingDirection ?? undefined,
  trafficDirection: item.trafficDirection ?? undefined,
  estimatedTraffic: item.estimatedTraffic ?? undefined,
  loopLengthSeconds: item.loopLengthSeconds ?? undefined,
  spotsPerHour: item.spotsPerHour ?? undefined,
  screenSpecs: item.screenSpecs ?? undefined,
  numberOfVehicles: item.numberOfVehicles ?? undefined,
  route: item.route ?? undefined,
  depot: item.depot ?? undefined,
  brandingType: item.brandingType ?? undefined,
  ratePerVehiclePerMonth: item.ratePerVehiclePerMonth ?? undefined,
  operatorName: item.operatorName ?? undefined,
  itinerary: item.itinerary ?? undefined,
  operationDays: item.operationDays ?? undefined,
  hasLedScreen: item.hasLedScreen ?? undefined,
  hasAudioSystem: item.hasAudioSystem ?? undefined,
  hasCanopy: item.hasCanopy ?? undefined,
  ratePerDay: item.ratePerDay ?? undefined,
  propertyName: item.propertyName ?? undefined,
  phase: item.phase ?? undefined,
  profile: item.profile ?? undefined,
  pinCode: item.pinCode ?? undefined,
  propertyPriceUptoCr: item.propertyPriceUptoCr ?? undefined,
  screenSize: item.screenSize ?? undefined,
  propertyVisualLink: item.propertyVisualLink ?? undefined,
  numberOfScreens: item.numberOfScreens ?? undefined,
  households: item.households ?? undefined,
  approxReach: item.approxReach ?? undefined,
  monthlyImpressions: item.monthlyImpressions ?? undefined,
  monthlyAdBudget: item.monthlyAdBudget ?? undefined,
  discountedMonthlyAdBudget: item.discountedMonthlyAdBudget ?? undefined,
  mediaSiteId: item.mediaSiteId ?? undefined,
  buildingAge: item.buildingAge ?? undefined,
  propertyType: item.propertyType ?? undefined,
  nccsClass: item.nccsClass ?? undefined,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});
