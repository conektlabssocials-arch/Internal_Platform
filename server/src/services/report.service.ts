import { inject, injectable } from 'tsyringe';

import { TOKENS } from '../config/tokens.js';
import { getEffectiveCategoryGroup } from '../dto/inventory.dto.js';
import type { ICampaignRepository } from '../repositories/campaign.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IOperationRepository } from '../repositories/operation.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import { getConfirmationStatus } from './inventory.service.js';
import { HttpError } from '../utils/httpError.js';

export type ReportFilters = {
  from?: string;
  to?: string;
  city?: string;
  categoryGroup?: string;
};

export interface IReportService {
  pipeline(filters: ReportFilters): Promise<unknown>;
  inventoryHealth(filters: ReportFilters): Promise<unknown>;
  profitability(filters: ReportFilters): Promise<unknown>;
  operationsDelivery(filters: ReportFilters): Promise<unknown>;
  supplierPerformance(filters: ReportFilters): Promise<unknown>;
}

const dateValue = (value: unknown) => {
  if (!value) return undefined;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseRange = (filters: ReportFilters) => {
  const from = filters.from ? dateValue(`${filters.from}T00:00:00.000Z`) : undefined;
  const to = filters.to ? dateValue(`${filters.to}T23:59:59.999Z`) : undefined;
  if (filters.from && !from) throw new HttpError(400, 'from is invalid');
  if (filters.to && !to) throw new HttpError(400, 'to is invalid');
  if (from && to && to < from) {
    throw new HttpError(400, 'to cannot be before from');
  }
  return { from, to };
};

const withinRange = (
  value: unknown,
  range: { from?: Date; to?: Date },
) => {
  if (!range.from && !range.to) return true;
  const date = dateValue(value);
  if (!date) return false;
  return (!range.from || date >= range.from) && (!range.to || date <= range.to);
};

const money = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const percent = (numerator: number, denominator: number) =>
  denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;

const campaignValue = (campaign: any) =>
  money(
    campaign.expectedRevenue ||
      campaign.budget?.fixed ||
      campaign.budget?.max,
  );

const reportRange = (
  range: { from?: Date; to?: Date },
  generatedAt: Date,
) => ({
  from: range.from?.toISOString(),
  to: range.to?.toISOString(),
  generatedAt: generatedAt.toISOString(),
});

const countBy = (items: any[], key: (item: any) => string | undefined) => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item) || 'Unknown';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
};

@injectable()
export class ReportService implements IReportService {
  constructor(
    @inject(TOKENS.CampaignRepository)
    private readonly campaigns: ICampaignRepository,
    @inject(TOKENS.PlanRepository)
    private readonly plans: IPlanRepository,
    @inject(TOKENS.InventoryRepository)
    private readonly inventory: IInventoryRepository,
    @inject(TOKENS.OperationRepository)
    private readonly operations: IOperationRepository,
  ) {}

  async pipeline(filters: ReportFilters) {
    const range = parseRange(filters);
    const generatedAt = new Date();
    const campaigns = (await this.campaigns.findAll()).filter((campaign) =>
      withinRange(campaign.createdAt, range),
    );
    const open = campaigns.filter(
      (campaign) => !['Won', 'Lost'].includes(campaign.status),
    );
    const won = campaigns.filter((campaign) => campaign.status === 'Won');
    const lost = campaigns.filter((campaign) => campaign.status === 'Lost');
    const closed = won.length + lost.length;
    const now = generatedAt.getTime();

    return {
      report: 'campaign_pipeline',
      range: reportRange(range, generatedAt),
      totals: {
        campaigns: campaigns.length,
        open: open.length,
        won: won.length,
        lost: lost.length,
        conversionRate: percent(won.length, closed),
        openPipelineValue: open.reduce(
          (sum, campaign) => sum + campaignValue(campaign),
          0,
        ),
        wonValue: won.reduce(
          (sum, campaign) => sum + campaignValue(campaign),
          0,
        ),
        lostValue: lost.reduce(
          (sum, campaign) => sum + campaignValue(campaign),
          0,
        ),
        overdueFollowUps: open.filter((campaign) => {
          const due = dateValue(campaign.nextFollowUpAt);
          return Boolean(due && due.getTime() < now);
        }).length,
        highPriorityOpen: open.filter(
          (campaign) => campaign.priority === 'High',
        ).length,
      },
      byStatus: countBy(campaigns, (campaign) => campaign.status),
      bySource: countBy(campaigns, (campaign) => campaign.source),
      byClientType: countBy(campaigns, (campaign) => campaign.clientType),
      topOpenOpportunities: open
        .map((campaign) => ({
          id: campaign._id.toString(),
          campaignCode: campaign.campaignCode,
          title: campaign.title,
          status: campaign.status,
          priority: campaign.priority,
          value: campaignValue(campaign),
          nextFollowUpAt: campaign.nextFollowUpAt,
        }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 10),
    };
  }

  async inventoryHealth(filters: ReportFilters) {
    const range = parseRange(filters);
    const generatedAt = new Date();
    const city = filters.city?.trim().toLowerCase();
    const category = filters.categoryGroup?.trim().toLowerCase();
    const inventory = (await this.inventory.find()).filter((item) => {
      const cityMatches = !city || item.city?.toLowerCase().includes(city);
      const categoryMatches =
        !category ||
        getEffectiveCategoryGroup(item)?.toLowerCase() === category;
      return (
        cityMatches &&
        categoryMatches &&
        withinRange(item.createdAt, range)
      );
    });
    const active = inventory.filter((item) => item.status === 'active');
    const fresh = inventory.filter(
      (item) => getConfirmationStatus(item) === 'fresh',
    );
    const stale = inventory.filter(
      (item) => getConfirmationStatus(item) === 'stale',
    );
    const neverConfirmed = inventory.filter(
      (item) => getConfirmationStatus(item) === 'never_confirmed',
    );
    const hasCost = inventory.filter((item) => item.internalCost !== undefined);
    const hasPrice = inventory.filter((item) => item.sellingPrice !== undefined);

    return {
      report: 'inventory_health',
      range: reportRange(range, generatedAt),
      filters: {
        city: filters.city,
        categoryGroup: filters.categoryGroup,
      },
      totals: {
        inventory: inventory.length,
        active: active.length,
        inactive: inventory.length - active.length,
        available: active.filter(
          (item) => item.availabilityStatus === 'available',
        ).length,
        booked: inventory.filter(
          (item) => item.availabilityStatus === 'booked',
        ).length,
        hold: inventory.filter(
          (item) => item.availabilityStatus === 'hold',
        ).length,
        fresh: fresh.length,
        stale: stale.length,
        neverConfirmed: neverConfirmed.length,
        freshCoverageRate: percent(fresh.length, inventory.length),
        internalCostCoverageRate: percent(hasCost.length, inventory.length),
        sellingPriceCoverageRate: percent(hasPrice.length, inventory.length),
      },
      byCategory: countBy(inventory, (item) =>
        getEffectiveCategoryGroup(item),
      ),
      byCity: countBy(inventory, (item) => item.city),
      needsAttention: [...stale, ...neverConfirmed]
        .map((item) => ({
          id: item._id.toString(),
          inventoryCode: item.inventoryCode,
          title: item.title,
          city: item.city,
          area: item.area,
          availabilityStatus: item.availabilityStatus,
          confirmationStatus: getConfirmationStatus(item),
          lastConfirmedAt: item.lastConfirmedAt,
        }))
        .slice(0, 20),
    };
  }

  async profitability(filters: ReportFilters) {
    const range = parseRange(filters);
    const generatedAt = new Date();
    const plans = (await this.plans.find()).filter(
      (plan) =>
        plan.status === 'Won' &&
        withinRange(plan.wonAt || plan.updatedAt || plan.createdAt, range),
    );
    const subtotal = plans.reduce(
      (sum, plan) => sum + money(plan.pricing?.subtotal),
      0,
    );
    const tax = plans.reduce(
      (sum, plan) => sum + money(plan.pricing?.taxAmount),
      0,
    );
    const revenue = plans.reduce(
      (sum, plan) => sum + money(plan.pricing?.grandTotal),
      0,
    );
    const internalCost = plans.reduce(
      (sum, plan) => sum + money(plan.pricing?.internalCostTotal),
      0,
    );
    const margin = plans.reduce(
      (sum, plan) => sum + money(plan.pricing?.marginAmount),
      0,
    );

    return {
      report: 'profitability',
      range: reportRange(range, generatedAt),
      totals: {
        wonPlans: plans.length,
        subtotal,
        tax,
        revenue,
        internalCost,
        margin,
        marginPercentage: percent(margin, subtotal),
      },
      topPlansByMargin: plans
        .map((plan) => ({
          id: plan._id.toString(),
          campaignId: plan.campaign.toString(),
          versionLabel: plan.versionLabel,
          title: plan.title,
          subtotal: money(plan.pricing?.subtotal),
          revenue: money(plan.pricing?.grandTotal),
          internalCost: money(plan.pricing?.internalCostTotal),
          margin: money(plan.pricing?.marginAmount),
          marginPercentage: money(plan.pricing?.marginPercentage),
          wonAt: plan.wonAt,
        }))
        .sort((left, right) => right.margin - left.margin)
        .slice(0, 15),
    };
  }

  async operationsDelivery(filters: ReportFilters) {
    const range = parseRange(filters);
    const generatedAt = new Date();
    const city = filters.city?.trim().toLowerCase();
    const category = filters.categoryGroup?.trim().toLowerCase();
    const operations = (await this.operations.findAll()).filter((operation) =>
      withinRange(operation.createdAt, range),
    );
    const items = operations
      .flatMap((operation) =>
        (operation.items || []).map((item: any) => ({ operation, item })),
      )
      .filter(({ item }) => {
        const cityMatches = !city || item.city?.toLowerCase().includes(city);
        const categoryMatches =
          !category || item.categoryGroup?.toLowerCase() === category;
        return cityMatches && categoryMatches;
      });
    const startOfToday = new Date(generatedAt);
    startOfToday.setHours(0, 0, 0, 0);
    const overdue = items.filter(({ item }) => {
      const scheduled = dateValue(item.mounting?.scheduledDate);
      return Boolean(
        scheduled && scheduled < startOfToday && !item.mounting?.completed,
      );
    });
    const mounted = items.filter(({ item }) => item.mounting?.completed);
    const proofUploaded = items.filter(({ item }) => item.proof?.uploaded);

    return {
      report: 'operations_delivery',
      range: reportRange(range, generatedAt),
      filters: {
        city: filters.city,
        categoryGroup: filters.categoryGroup,
      },
      totals: {
        operations: operations.length,
        items: items.length,
        completedOperations: operations.filter(
          (operation) => operation.status === 'Completed',
        ).length,
        averageProgress: operations.length
          ? Number(
              (
                operations.reduce(
                  (sum, operation) =>
                    sum + money(operation.overallProgress?.percentage),
                  0,
                ) / operations.length
              ).toFixed(2),
            )
          : 0,
        creativeReceived: items.filter(({ item }) => item.creative?.received)
          .length,
        purchaseOrdersSent: items.filter(
          ({ item }) => item.purchaseOrder?.sent,
        ).length,
        mounted: mounted.length,
        proofUploaded: proofUploaded.length,
        overdueMountings: overdue.length,
        proofPending: mounted.filter(({ item }) => !item.proof?.uploaded).length,
        mountingCompletionRate: percent(mounted.length, items.length),
        proofCompletionRate: percent(proofUploaded.length, items.length),
      },
      byStatus: countBy(operations, (operation) => operation.status),
      overdueItems: overdue.slice(0, 20).map(({ operation, item }) => ({
        operationId: operation._id.toString(),
        operationCode: operation.operationCode,
        inventoryCode: item.inventoryCode,
        title: item.title,
        city: item.city,
        area: item.area,
        scheduledDate: item.mounting?.scheduledDate,
      })),
    };
  }

  async supplierPerformance(filters: ReportFilters) {
    const range = parseRange(filters);
    const generatedAt = new Date();
    const operations = (await this.operations.findAll()).filter((operation) =>
      withinRange(operation.createdAt, range),
    );
    const startOfToday = new Date(generatedAt);
    startOfToday.setHours(0, 0, 0, 0);
    const suppliers = new Map<
      string,
      {
        supplierName: string;
        items: number;
        mounted: number;
        proofUploaded: number;
        completed: number;
        overdue: number;
      }
    >();

    for (const operation of operations) {
      for (const item of operation.items || []) {
        const supplierName =
          item.supplierName || item.ownerName || 'Unassigned supplier';
        const summary = suppliers.get(supplierName) || {
          supplierName,
          items: 0,
          mounted: 0,
          proofUploaded: 0,
          completed: 0,
          overdue: 0,
        };
        summary.items += 1;
        if (item.mounting?.completed) summary.mounted += 1;
        if (item.proof?.uploaded) summary.proofUploaded += 1;
        if (item.itemStatus === 'Completed') summary.completed += 1;
        const scheduled = dateValue(item.mounting?.scheduledDate);
        if (scheduled && scheduled < startOfToday && !item.mounting?.completed) {
          summary.overdue += 1;
        }
        suppliers.set(supplierName, summary);
      }
    }

    const rows = [...suppliers.values()]
      .map((supplier) => ({
        ...supplier,
        mountingCompletionRate: percent(supplier.mounted, supplier.items),
        proofCompletionRate: percent(supplier.proofUploaded, supplier.items),
        completionRate: percent(supplier.completed, supplier.items),
      }))
      .sort(
        (left, right) =>
          right.items - left.items ||
          right.completionRate - left.completionRate ||
          left.supplierName.localeCompare(right.supplierName),
      );

    return {
      report: 'supplier_performance',
      range: reportRange(range, generatedAt),
      totals: {
        suppliers: rows.length,
        assignedItems: rows.reduce((sum, row) => sum + row.items, 0),
        overdueItems: rows.reduce((sum, row) => sum + row.overdue, 0),
      },
      suppliers: rows,
    };
  }
}
