import { inject, injectable } from 'tsyringe';

import { TOKENS } from '../config/tokens.js';
import { getEffectiveCategoryGroup } from '../dto/inventory.dto.js';
import { categoryGroups } from '../models/inventory.model.js';
import type { ICampaignRepository } from '../repositories/campaign.repository.js';
import type { IDocumentRepository } from '../repositories/document.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IOperationRepository } from '../repositories/operation.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import type { IShareRepository } from '../repositories/share.repository.js';
import { getConfirmationStatus } from './inventory.service.js';

type DashboardSnapshot = {
  campaigns: any[];
  plans: any[];
  inventory: any[];
  operations: any[];
  shares: any[];
  documents: any[];
};

export interface IDashboardService {
  overview(userId: string): Promise<unknown>;
  myWork(userId: string): Promise<unknown>;
  campaigns(): Promise<unknown>;
  plans(): Promise<unknown>;
  inventory(): Promise<unknown>;
  operations(): Promise<unknown>;
}

const id = (value: any) =>
  value && typeof value === 'object' && value._id
    ? value._id.toString()
    : value?.toString?.() || '';

const dateValue = (value: unknown) => {
  if (!value) return undefined;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const latestFirst = (left: any, right: any) =>
  (dateValue(right.updatedAt || right.createdAt)?.getTime() || 0) -
  (dateValue(left.updatedAt || left.createdAt)?.getTime() || 0);

const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const isDue = (value: unknown, end: Date) => {
  const date = dateValue(value);
  return Boolean(date && date <= end);
};

const campaignValue = (campaign: any) =>
  Number(
    campaign.expectedRevenue ||
      campaign.budget?.fixed ||
      campaign.budget?.max ||
      0,
  ) || 0;

const planValue = (plan: any) => Number(plan.pricing?.grandTotal || 0);

const campaignSummaryItem = (campaign: any) => ({
  id: id(campaign._id),
  campaignCode: campaign.campaignCode,
  title: campaign.title,
  status: campaign.status,
  priority: campaign.priority,
  value: campaignValue(campaign),
  nextFollowUpAt: campaign.nextFollowUpAt,
  createdAt: campaign.createdAt,
});

const planSummaryItem = (plan: any, campaignsById: Map<string, any>) => {
  const campaign = campaignsById.get(id(plan.campaign));
  return {
    id: id(plan._id),
    title: plan.title,
    versionLabel: plan.versionLabel,
    status: plan.status,
    grandTotal: planValue(plan),
    campaignId: id(plan.campaign),
    campaignCode: campaign?.campaignCode,
    campaignTitle: campaign?.title,
    sharedAt: plan.sharedAt,
    updatedAt: plan.updatedAt,
  };
};

const operationSummaryItem = (operation: any) => ({
  id: id(operation._id),
  operationCode: operation.operationCode,
  campaignCode: operation.campaignCode,
  campaignTitle: operation.campaignTitle,
  clientName: operation.clientName,
  status: operation.status,
  priority: operation.priority,
  progress: operation.overallProgress?.percentage || 0,
  updatedAt: operation.updatedAt,
});

@injectable()
export class DashboardService implements IDashboardService {
  constructor(
    @inject(TOKENS.CampaignRepository)
    private readonly campaignRepository: ICampaignRepository,
    @inject(TOKENS.PlanRepository)
    private readonly planRepository: IPlanRepository,
    @inject(TOKENS.InventoryRepository)
    private readonly inventoryRepository: IInventoryRepository,
    @inject(TOKENS.OperationRepository)
    private readonly operationRepository: IOperationRepository,
    @inject(TOKENS.ShareRepository)
    private readonly shareRepository: IShareRepository,
    @inject(TOKENS.DocumentRepository)
    private readonly documentRepository: IDocumentRepository,
  ) {}

  async overview(userId: string) {
    const snapshot = await this.loadSnapshot();
    return {
      myWork: this.buildMyWork(snapshot, userId),
      campaigns: this.buildCampaigns(snapshot),
      plans: this.buildPlans(snapshot),
      inventory: this.buildInventory(snapshot),
      operations: this.buildOperations(snapshot),
      recentActivity: this.buildRecentActivity(snapshot),
    };
  }

  async myWork(userId: string) {
    return this.buildMyWork(await this.loadSnapshot(), userId);
  }

  async campaigns() {
    return this.buildCampaigns(await this.loadSnapshot());
  }

  async plans() {
    return this.buildPlans(await this.loadSnapshot());
  }

  async inventory() {
    return this.buildInventory(await this.loadSnapshot());
  }

  async operations() {
    return this.buildOperations(await this.loadSnapshot());
  }

  private async loadSnapshot(): Promise<DashboardSnapshot> {
    const [campaigns, plans, inventory, operations, shares, documents] =
      await Promise.all([
        this.campaignRepository.findAll(),
        this.planRepository.find(),
        this.inventoryRepository.find(),
        this.operationRepository.findAll(),
        this.shareRepository.find(),
        this.documentRepository.find(),
      ]);

    return { campaigns, plans, inventory, operations, shares, documents };
  }

  private buildMyWork(snapshot: DashboardSnapshot, userId: string) {
    const { end } = todayRange();
    const openCampaigns = snapshot.campaigns.filter(
      (campaign) =>
        id(campaign.ownerUser) === userId &&
        !['Won', 'Lost'].includes(campaign.status),
    );
    const ownedCampaignIds = new Set(openCampaigns.map((campaign) => id(campaign._id)));
    const draftPlans = snapshot.plans.filter(
      (plan) =>
        plan.status === 'Draft' &&
        (id(plan.createdBy) === userId || ownedCampaignIds.has(id(plan.campaign))),
    );
    const sharedPlans = snapshot.plans.filter(
      (plan) =>
        ['Shared', 'Negotiating'].includes(plan.status) &&
        ownedCampaignIds.has(id(plan.campaign)),
    );
    const ownedOperations = snapshot.operations.filter(
      (operation) => id(operation.operationOwner) === userId,
    );
    const pendingOperations = ownedOperations.filter(
      (operation) => !['Completed', 'Cancelled'].includes(operation.status),
    );
    const proofPendingOperations = ownedOperations.filter((operation) =>
      operation.items?.some(
        (item: any) => item.mounting?.completed && !item.proof?.uploaded,
      ),
    );
    const followUps = openCampaigns.filter((campaign) =>
      isDue(campaign.nextFollowUpAt, end),
    );

    const tasks = [
      ...followUps.map((campaign) => ({
        type: 'follow_up',
        title: `Follow up: ${campaign.title}`,
        referenceId: id(campaign._id),
        referenceCode: campaign.campaignCode,
        dueAt: campaign.nextFollowUpAt,
      })),
      ...snapshot.inventory
        .filter(
          (item) =>
            item.status === 'active' &&
            getConfirmationStatus(item) !== 'fresh',
        )
        .slice(0, 4)
        .map((item) => ({
          type: 'inventory_confirmation',
          title: `Confirm inventory: ${item.inventoryCode}`,
          referenceId: id(item._id),
          referenceCode: item.inventoryCode,
          dueAt: item.lastConfirmedAt,
        })),
      ...pendingOperations.flatMap((operation) =>
        (operation.items || [])
          .filter(
            (item: any) =>
              (item.mounting?.scheduledDate &&
                isDue(item.mounting.scheduledDate, end) &&
                !item.mounting.completed) ||
              (item.mounting?.completed && !item.proof?.uploaded),
          )
          .slice(0, 3)
          .map((item: any) => ({
            type: item.mounting?.completed ? 'proof_pending' : 'mounting_overdue',
            title: item.mounting?.completed
              ? `Upload proof: ${item.inventoryCode || item.title}`
              : `Complete mounting: ${item.inventoryCode || item.title}`,
            referenceId: id(operation._id),
            referenceCode: operation.operationCode,
            dueAt: item.mounting?.scheduledDate,
          })),
      ),
    ]
      .sort(
        (left, right) =>
          (dateValue(left.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER) -
          (dateValue(right.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER),
      )
      .slice(0, 12);

    return {
      myOpenCampaigns: openCampaigns.length,
      myFollowUpsDueToday: followUps.length,
      myDraftPlans: draftPlans.length,
      mySharedPlans: sharedPlans.length,
      myOperationsPending: pendingOperations.length,
      myProofPending: proofPendingOperations.length,
      todayTasks: tasks,
    };
  }

  private buildCampaigns(snapshot: DashboardSnapshot) {
    const { end } = todayRange();
    const count = (status: string) =>
      snapshot.campaigns.filter((campaign) => campaign.status === status).length;
    const open = snapshot.campaigns.filter(
      (campaign) => !['Won', 'Lost'].includes(campaign.status),
    );

    return {
      totalCampaigns: snapshot.campaigns.length,
      new: count('New'),
      inDiscussion: count('In Discussion'),
      planShared: count('Plan Shared'),
      negotiating: count('Negotiating'),
      won: count('Won'),
      lost: count('Lost'),
      onHold: count('On Hold'),
      openPipelineValue: open.reduce(
        (sum, campaign) => sum + campaignValue(campaign),
        0,
      ),
      wonValue: snapshot.campaigns
        .filter((campaign) => campaign.status === 'Won')
        .reduce((sum, campaign) => sum + campaignValue(campaign), 0),
      lostValue: snapshot.campaigns
        .filter((campaign) => campaign.status === 'Lost')
        .reduce((sum, campaign) => sum + campaignValue(campaign), 0),
      followUpsDueToday: open.filter((campaign) =>
        isDue(campaign.nextFollowUpAt, end),
      ).length,
      highPriorityOpen: open.filter((campaign) => campaign.priority === 'High').length,
      recentCampaigns: [...snapshot.campaigns]
        .sort(latestFirst)
        .slice(0, 5)
        .map(campaignSummaryItem),
    };
  }

  private buildPlans(snapshot: DashboardSnapshot) {
    const campaignsById = new Map(
      snapshot.campaigns.map((campaign) => [id(campaign._id), campaign]),
    );
    const count = (status: string) =>
      snapshot.plans.filter((plan) => plan.status === status).length;
    const awaiting = snapshot.plans.filter((plan) =>
      ['Shared', 'Negotiating'].includes(plan.status),
    );

    return {
      totalPlans: snapshot.plans.length,
      draft: count('Draft'),
      shared: count('Shared'),
      negotiating: count('Negotiating'),
      won: count('Won'),
      lost: count('Lost'),
      totalSharedValue: awaiting.reduce((sum, plan) => sum + planValue(plan), 0),
      totalWonPlanValue: snapshot.plans
        .filter((plan) => plan.status === 'Won')
        .reduce((sum, plan) => sum + planValue(plan), 0),
      plansAwaitingResponse: awaiting.length,
      recentSharedPlans: [...awaiting]
        .sort(latestFirst)
        .slice(0, 5)
        .map((plan) => planSummaryItem(plan, campaignsById)),
      topViewedShares: [...snapshot.shares]
        .sort((left, right) => (right.viewCount || 0) - (left.viewCount || 0))
        .slice(0, 5)
        .map((share) => ({
          id: id(share._id),
          planId: id(share.plan),
          campaignId: id(share.campaign),
          planVersionLabel: share.metadata?.planVersionLabel,
          campaignCode: share.metadata?.campaignCode,
          clientName: share.metadata?.clientName,
          viewCount: share.viewCount || 0,
          lastViewedAt: share.lastViewedAt,
          status: share.status,
          channel: share.channel,
        })),
    };
  }

  private buildInventory(snapshot: DashboardSnapshot) {
    const confirmation = (status: string) =>
      snapshot.inventory.filter((item) => getConfirmationStatus(item) === status);
    const needsConfirmation = snapshot.inventory
      .filter(
        (item) =>
          item.status === 'active' && getConfirmationStatus(item) !== 'fresh',
      )
      .sort((left, right) => {
        const leftDate = dateValue(left.lastConfirmedAt)?.getTime() || 0;
        const rightDate = dateValue(right.lastConfirmedAt)?.getTime() || 0;
        return leftDate - rightDate;
      })
      .slice(0, 10)
      .map((item) => ({
        id: id(item._id),
        inventoryCode: item.inventoryCode,
        title: item.title,
        categoryGroup: getEffectiveCategoryGroup(item),
        city: item.city,
        area: item.area,
        confirmationStatus: getConfirmationStatus(item),
        lastConfirmedAt: item.lastConfirmedAt,
      }));

    return {
      totalInventory: snapshot.inventory.length,
      activeInventory: snapshot.inventory.filter((item) => item.status === 'active').length,
      availableInventory: snapshot.inventory.filter(
        (item) => item.status === 'active' && item.availabilityStatus === 'available',
      ).length,
      bookedInventory: snapshot.inventory.filter(
        (item) => item.availabilityStatus === 'booked',
      ).length,
      holdInventory: snapshot.inventory.filter(
        (item) => item.availabilityStatus === 'hold',
      ).length,
      staleInventory: confirmation('stale').length,
      neverConfirmedInventory: confirmation('never_confirmed').length,
      freshInventory: confirmation('fresh').length,
      byCategory: categoryGroups.map((categoryGroup) => {
        const items = snapshot.inventory.filter(
          (item) => getEffectiveCategoryGroup(item) === categoryGroup,
        );
        return {
          categoryGroup,
          total: items.length,
          available: items.filter(
            (item) => item.status === 'active' && item.availabilityStatus === 'available',
          ).length,
          stale: items.filter((item) => getConfirmationStatus(item) === 'stale').length,
          neverConfirmed: items.filter(
            (item) => getConfirmationStatus(item) === 'never_confirmed',
          ).length,
        };
      }),
      needsConfirmation,
    };
  }

  private buildOperations(snapshot: DashboardSnapshot) {
    const { start } = todayRange();
    const items = snapshot.operations.flatMap((operation) =>
      (operation.items || []).map((item: any) => ({ operation, item })),
    );
    const overdueItems = items.filter(({ item }) => {
      const scheduled = dateValue(item.mounting?.scheduledDate);
      return Boolean(scheduled && scheduled < start && !item.mounting?.completed);
    });
    const proofPendingItems = items.filter(
      ({ item }) => item.mounting?.completed && !item.proof?.uploaded,
    );
    const count = (status: string) =>
      snapshot.operations.filter((operation) => operation.status === status).length;
    const itemSummary = ({ operation, item }: any) => ({
      operationId: id(operation._id),
      operationCode: operation.operationCode,
      campaignTitle: operation.campaignTitle,
      itemId: id(item._id),
      inventoryCode: item.inventoryCode,
      title: item.title,
      city: item.city,
      area: item.area,
      scheduledDate: item.mounting?.scheduledDate,
    });

    return {
      totalOperations: snapshot.operations.length,
      pending: count('Pending'),
      inProgress:
        count('In Progress') + count('Partially Mounted') + count('Proof Pending'),
      mounted: count('Mounted'),
      proofPending: proofPendingItems.length,
      completed: count('Completed'),
      overdueMountings: overdueItems.length,
      creativePending: items.filter(
        ({ item }) => item.creative?.required && !item.creative?.received,
      ).length,
      poPending: items.filter(
        ({ item }) => item.purchaseOrder?.required && !item.purchaseOrder?.sent,
      ).length,
      recentOperations: [...snapshot.operations]
        .sort(latestFirst)
        .slice(0, 5)
        .map(operationSummaryItem),
      overdueItems: overdueItems.slice(0, 10).map(itemSummary),
      proofPendingItems: proofPendingItems.slice(0, 10).map(itemSummary),
    };
  }

  private buildRecentActivity(snapshot: DashboardSnapshot) {
    const campaignActivity = snapshot.campaigns.map((campaign) => ({
      type: 'campaign_created',
      title: `Campaign created: ${campaign.title}`,
      createdAt: campaign.createdAt,
      referenceType: 'Campaign',
      referenceId: id(campaign._id),
      referenceCode: campaign.campaignCode,
    }));
    const planActivity = snapshot.plans.map((plan) => ({
      type: 'plan_updated',
      title: `Plan ${plan.versionLabel}: ${plan.title}`,
      createdAt: plan.updatedAt || plan.createdAt,
      referenceType: 'Plan',
      referenceId: id(plan._id),
      referenceCode: plan.versionLabel,
    }));
    const operationActivity = snapshot.operations.map((operation) => ({
      type: 'operation_updated',
      title: `Work Order ${operation.operationCode}: ${operation.status}`,
      createdAt: operation.updatedAt || operation.createdAt,
      referenceType: 'Operation',
      referenceId: id(operation._id),
      referenceCode: operation.operationCode,
    }));
    const documentActivity = snapshot.documents.map((document) => ({
      type: 'document_generated',
      title: `${document.documentType} generated`,
      createdAt: document.generatedAt || document.createdAt,
      referenceType: 'Document',
      referenceId: id(document._id),
      referenceCode: document.metadata?.campaignCode,
    }));

    return [
      ...campaignActivity,
      ...planActivity,
      ...operationActivity,
      ...documentActivity,
    ]
      .filter((activity) => activity.createdAt)
      .sort(
        (left, right) =>
          (dateValue(right.createdAt)?.getTime() || 0) -
          (dateValue(left.createdAt)?.getTime() || 0),
      )
      .slice(0, 10);
  }
}
