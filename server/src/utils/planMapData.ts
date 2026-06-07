type PlanMapSourceItem = {
  inventory?: unknown;
  inventoryCode?: string;
  title?: string;
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
  startDate?: Date;
  endDate?: Date;
  quantity?: number;
  unitSellingPrice?: number;
  totalSellingPrice?: number;
  notes?: string;
};

const itemId = (item: PlanMapSourceItem, index: number) => {
  const inventory = item.inventory as { _id?: unknown; toString?: () => string } | undefined;
  return inventory?._id?.toString() || inventory?.toString?.() || item.inventoryCode || `item-${index + 1}`;
};

const baseItem = (item: PlanMapSourceItem, index: number) => ({
  planItemId: itemId(item, index),
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
  quantity: item.quantity || 1,
  unitSellingPrice: item.unitSellingPrice || 0,
  totalSellingPrice: item.totalSellingPrice || 0,
});

export const buildPlanMapData = (items: PlanMapSourceItem[] = []) => {
  const mapItems = items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.categoryGroup === 'Outdoor' &&
        Number.isFinite(item.location?.latitude) &&
        Number.isFinite(item.location?.longitude),
    )
    .map(({ item, index }) => ({
      ...baseItem(item, index),
      address: item.location?.address,
      latitude: item.location?.latitude as number,
      longitude: item.location?.longitude as number,
      photoUrl: item.photos?.[0],
    }));

  const nonMapItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => ['Auto', 'Bus', 'Mobile Van'].includes(item.categoryGroup || ''))
    .map(({ item, index }) => ({
      ...baseItem(item, index),
      route: item.route,
      depot: item.depot,
      itinerary: item.itinerary,
      notes: item.notes,
    }));

  return { mapItems, nonMapItems };
};
