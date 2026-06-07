import type {
  OperationItemStatus,
  OperationStatus,
} from '../models/operation.model.js';

type TrackableItem = {
  itemStatus?: string;
  creative?: { required?: boolean; received?: boolean };
  purchaseOrder?: { required?: boolean; sent?: boolean };
  mounting?: { scheduledDate?: Date; completed?: boolean };
  proof?: { uploaded?: boolean };
  takedown?: { scheduledDate?: Date };
};

export const calculateItemStatus = (item: TrackableItem): OperationItemStatus => {
  if (item.itemStatus === 'Cancelled' || item.itemStatus === 'On Hold' || item.itemStatus === 'Completed') {
    return item.itemStatus;
  }
  if (item.proof?.uploaded) return 'Proof Uploaded';
  if (item.mounting?.completed) return 'Mounted';
  if (item.mounting?.scheduledDate) return 'Mounting Scheduled';
  if (item.creative?.required && !item.creative.received) return 'Creative Pending';
  if (item.purchaseOrder?.required && !item.purchaseOrder.sent) return 'PO Pending';
  return 'Pending';
};

export const calculateOperationProgress = (items: TrackableItem[]) => {
  const totalItems = items.length;
  const proofUploadedCount = items.filter((item) => item.proof?.uploaded).length;
  return {
    totalItems,
    creativeReceivedCount: items.filter((item) => item.creative?.received).length,
    poSentCount: items.filter((item) => item.purchaseOrder?.sent).length,
    mountingCompletedCount: items.filter((item) => item.mounting?.completed).length,
    proofUploadedCount,
    completedItemCount: items.filter((item) => item.itemStatus === 'Completed').length,
    percentage: totalItems ? Math.round((proofUploadedCount / totalItems) * 100) : 0,
  };
};

export const calculateOperationStatus = (
  items: TrackableItem[],
  currentStatus?: string,
): OperationStatus => {
  if (currentStatus === 'Cancelled' || currentStatus === 'On Hold') {
    return currentStatus;
  }
  if (!items.length) return 'Pending';
  if (items.every((item) => item.itemStatus === 'Completed')) return 'Completed';

  const mountedCount = items.filter((item) => item.mounting?.completed).length;
  const proofCount = items.filter((item) => item.proof?.uploaded).length;
  if (mountedCount === items.length && proofCount < items.length) return 'Proof Pending';
  if (mountedCount === items.length) return 'Mounted';
  if (mountedCount > 0) return 'Partially Mounted';

  const started = items.some(
    (item) =>
      item.creative?.received ||
      item.purchaseOrder?.sent ||
      item.mounting?.scheduledDate ||
      item.proof?.uploaded,
  );
  return started ? 'In Progress' : 'Pending';
};

export const calculateImportantDates = (items: TrackableItem[]) => {
  const mountingDates = items
    .map((item) => item.mounting?.scheduledDate)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());
  const takedownDates = items
    .map((item) => item.takedown?.scheduledDate)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    firstMountingDate: mountingDates[0],
    lastMountingDate: mountingDates.at(-1),
    firstTakedownDate: takedownDates[0],
    lastTakedownDate: takedownDates.at(-1),
  };
};
