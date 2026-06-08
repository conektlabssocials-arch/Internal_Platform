export const getOperationCounterKey = (year: number) => `OPS-${year}`;

export const formatOperationCode = (year: number, sequence: number) =>
  `OPS-${year}-${sequence.toString().padStart(4, '0')}`;

export const getPurchaseOrderCounterKey = (year: number) => `PO-${year}`;

export const formatPurchaseOrderNumber = (year: number, sequence: number) =>
  `PO-${year}-${sequence.toString().padStart(4, '0')}`;
