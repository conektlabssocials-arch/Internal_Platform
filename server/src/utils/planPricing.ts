export type PlanPricingItemInput = {
  startDate?: Date;
  endDate?: Date;
  quantity?: number;
  unitSellingPrice?: number;
  unitInternalCost?: number;
  [key: string]: unknown;
};

export const calculateDurationDays = (startDate?: Date, endDate?: Date) => {
  if (!startDate || !endDate) return 1;
  const milliseconds = endDate.getTime() - startDate.getTime();
  return Math.max(Math.ceil(milliseconds / 86_400_000) + 1, 1);
};

export const calculatePlanItem = <T extends PlanPricingItemInput>(item: T) => {
  const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
  const unitSellingPrice = item.unitSellingPrice || 0;
  const unitInternalCost = item.unitInternalCost || 0;
  const totalSellingPrice = unitSellingPrice * quantity;
  const totalInternalCost = unitInternalCost * quantity;
  const marginAmount = totalSellingPrice - totalInternalCost;

  return {
    ...item,
    quantity,
    durationDays: calculateDurationDays(item.startDate, item.endDate),
    unitSellingPrice,
    totalSellingPrice,
    unitInternalCost,
    totalInternalCost,
    marginAmount,
    marginPercentage: totalSellingPrice ? (marginAmount / totalSellingPrice) * 100 : 0,
  };
};

export const calculatePlanPricing = (
  items: ReturnType<typeof calculatePlanItem>[],
  taxPercentage = 0,
) => {
  const subtotal = items.reduce((sum, item) => sum + item.totalSellingPrice, 0);
  const internalCostTotal = items.reduce((sum, item) => sum + item.totalInternalCost, 0);
  const taxAmount = (subtotal * taxPercentage) / 100;
  const marginAmount = subtotal - internalCostTotal;

  return {
    subtotal,
    taxPercentage,
    taxAmount,
    grandTotal: subtotal + taxAmount,
    internalCostTotal,
    marginAmount,
    marginPercentage: subtotal ? (marginAmount / subtotal) * 100 : 0,
  };
};
