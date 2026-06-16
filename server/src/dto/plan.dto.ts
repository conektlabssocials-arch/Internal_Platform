import type { PlanDocument, PlanStatus } from '../models/plan.model.js';

export type PlanItemInputDto = {
  inventory?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  quantity?: number;
  unitSellingPrice?: number;
  unitInternalCost?: number;
  notes?: string;
};

export type PlanMutationDto = {
  title?: string;
  items?: PlanItemInputDto[];
  taxPercentage?: number;
  clientNotes?: string;
  internalNotes?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type PlanStatusMutationDto = {
  status?: string;
  actorId: string;
};

const ref = (value: any) => {
  if (value && typeof value === 'object' && value._id) {
    return {
      id: value._id.toString(),
      name: value.name || value.title || value.campaignCode || '',
      email: value.email,
      campaignCode: value.campaignCode,
      title: value.title,
      startDate: value.startDate,
      endDate: value.endDate,
      client: value.client
        ? {
            id: value.client._id?.toString?.() || value.client.toString(),
            name: value.client.displayName || value.client.name,
          }
        : undefined,
    };
  }
  return { id: value?.toString?.() || '', name: '' };
};

export const mapPlanToDto = (plan: PlanDocument) => ({
  id: plan._id.toString(),
  campaign: ref(plan.campaign),
  versionNumber: plan.versionNumber,
  versionLabel: plan.versionLabel,
  title: plan.title,
  status: plan.status as PlanStatus,
  isLocked: plan.isLocked,
  items: (plan.items || []).map((item) => ({
    inventory: (item.inventory as any)?._id?.toString?.() || String(item.inventory),
    inventoryCode: item.inventoryCode,
    title: item.title,
    categoryGroup: item.categoryGroup,
    subCategory: item.subCategory,
    city: item.city,
    area: item.area,
    width: item.width,
    height: item.height,
    totalSqFt: item.totalSqFt,
    location: item.location
      ? {
          address: item.location.address,
          latitude: item.location.latitude,
          longitude: item.location.longitude,
        }
      : undefined,
    photos: item.photos || [],
    route: item.route,
    depot: item.depot,
    itinerary: item.itinerary,
    screenSize: item.screenSize,
    numberOfScreens: item.numberOfScreens,
    households: item.households,
    approxReach: item.approxReach,
    monthlyImpressions: item.monthlyImpressions,
    buildingAge: item.buildingAge,
    startDate: item.startDate,
    endDate: item.endDate,
    durationDays: item.durationDays,
    quantity: item.quantity,
    unitSellingPrice: item.unitSellingPrice,
    totalSellingPrice: item.totalSellingPrice,
    unitInternalCost: item.unitInternalCost,
    totalInternalCost: item.totalInternalCost,
    marginAmount: item.marginAmount,
    marginPercentage: item.marginPercentage,
    notes: item.notes,
  })),
  pricing: {
    subtotal: plan.pricing?.subtotal || 0,
    taxPercentage: plan.pricing?.taxPercentage || 0,
    taxAmount: plan.pricing?.taxAmount || 0,
    grandTotal: plan.pricing?.grandTotal || 0,
    internalCostTotal: plan.pricing?.internalCostTotal || 0,
    marginAmount: plan.pricing?.marginAmount || 0,
    marginPercentage: plan.pricing?.marginPercentage || 0,
  },
  clientNotes: plan.clientNotes,
  internalNotes: plan.internalNotes,
  clonedFromPlan: plan.clonedFromPlan?.toString(),
  sharedAt: plan.sharedAt,
  sharedBy: plan.sharedBy ? ref(plan.sharedBy) : undefined,
  wonAt: plan.wonAt,
  lostAt: plan.lostAt,
  createdBy: plan.createdBy ? ref(plan.createdBy) : undefined,
  updatedBy: plan.updatedBy ? ref(plan.updatedBy) : undefined,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});
