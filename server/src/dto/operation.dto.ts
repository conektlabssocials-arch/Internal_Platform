import type { OperationDocument } from '../models/operation.model.js';

const ref = (value: any) =>
  value && typeof value === 'object' && value._id
    ? { id: value._id.toString(), name: value.name || '', email: value.email }
    : value
      ? { id: value.toString(), name: '' }
      : undefined;

const id = (value: any) =>
  value && typeof value === 'object' && value._id
    ? value._id.toString()
    : value?.toString();

export const mapOperationToDto = (operation: OperationDocument) => ({
  id: operation._id.toString(),
  operationCode: operation.operationCode,
  campaign: id(operation.campaign),
  plan: id(operation.plan),
  client: id(operation.client),
  planVersionLabel: operation.planVersionLabel,
  campaignCode: operation.campaignCode,
  campaignTitle: operation.campaignTitle,
  clientName: operation.clientName,
  operationOwner: ref(operation.operationOwner),
  status: operation.status,
  priority: operation.priority,
  items: (operation.items || []).map((item: any) => ({
    id: item._id.toString(),
    planItemId: item.planItemId,
    inventory: item.inventory?.toString(),
    inventoryCode: item.inventoryCode,
    title: item.title,
    categoryGroup: item.categoryGroup,
    subCategory: item.subCategory,
    city: item.city,
    area: item.area,
    location: item.location,
    route: item.route,
    depot: item.depot,
    itinerary: item.itinerary,
    width: item.width,
    height: item.height,
    totalSqFt: item.totalSqFt,
    campaignStartDate: item.campaignStartDate,
    campaignEndDate: item.campaignEndDate,
    unitSellingPrice: item.unitSellingPrice,
    totalSellingPrice: item.totalSellingPrice,
    unitInternalCost: item.unitInternalCost,
    totalInternalCost: item.totalInternalCost,
    supplierName: item.supplierName,
    ownerName: item.ownerName,
    supplierEntity: item.supplierEntity?.toString(),
    ownerEntity: item.ownerEntity?.toString(),
    creative: item.creative,
    purchaseOrder: item.purchaseOrder,
    mounting: item.mounting,
    proof: item.proof,
    takedown: item.takedown,
    itemStatus: item.itemStatus,
    notes: item.notes,
  })),
  overallProgress: operation.overallProgress,
  importantDates: operation.importantDates,
  notes: operation.notes,
  createdBy: ref(operation.createdBy),
  updatedBy: ref(operation.updatedBy),
  createdAt: operation.createdAt,
  updatedAt: operation.updatedAt,
});
