import type { PlanMapData } from '../types/share';

type ClientPlanMapSource = {
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
  photos?: string[];
  route?: string;
  depot?: string;
  itinerary?: string;
  startDate?: string;
  endDate?: string;
  quantity?: number;
  unitSellingPrice?: number;
  totalSellingPrice?: number;
  notes?: string;
};

const base = (item: ClientPlanMapSource) => ({
  planItemId: item.inventory,
  inventoryCode: item.inventoryCode,
  title: item.title,
  categoryGroup: item.categoryGroup,
  subCategory: item.subCategory,
  city: item.city,
  area: item.area,
  width: item.width,
  height: item.height,
  totalSqFt: item.totalSqFt,
  startDate: item.startDate,
  endDate: item.endDate,
  quantity: Number(item.quantity) || 1,
  unitSellingPrice: Number(item.unitSellingPrice) || 0,
  totalSellingPrice:
    item.totalSellingPrice ??
    (Number(item.unitSellingPrice) || 0) * (Number(item.quantity) || 1),
});

export const buildClientPlanMapData = (
  items: ClientPlanMapSource[],
): PlanMapData => ({
  mapItems: items
    .filter(
      (item) =>
        item.categoryGroup === 'Outdoor' &&
        Number.isFinite(item.location?.latitude) &&
        Number.isFinite(item.location?.longitude),
    )
    .map((item) => ({
      ...base(item),
      address: item.location?.address,
      latitude: item.location?.latitude as number,
      longitude: item.location?.longitude as number,
      photoUrl: item.photos?.[0],
    })),
  nonMapItems: items
    .filter((item) => ['Auto', 'Bus', 'Mobile Van'].includes(item.categoryGroup || ''))
    .map((item) => ({
      ...base(item),
      route: item.route,
      depot: item.depot,
      itinerary: item.itinerary,
      notes: item.notes,
    })),
});
