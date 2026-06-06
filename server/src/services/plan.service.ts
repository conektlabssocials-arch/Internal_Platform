import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import { mapPlanToDto } from '../dto/plan.dto.js';
import type {
  PlanItemInputDto,
  PlanMutationDto,
  PlanStatusMutationDto,
} from '../dto/plan.dto.js';
import { getEffectiveCategoryGroup, getEffectiveSubCategory } from '../dto/inventory.dto.js';
import { planStatuses } from '../models/plan.model.js';
import type { PlanDocument, PlanStatus } from '../models/plan.model.js';
import type { ICampaignRepository } from '../repositories/campaign.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import { getConfirmationStatus } from './inventory.service.js';
import { calculatePlanItem, calculatePlanPricing } from '../utils/planPricing.js';
import { HttpError } from '../utils/httpError.js';

export interface IPlanService {
  listByCampaign(campaignId: string): Promise<unknown[]>;
  listRecent(): Promise<unknown[]>;
  getById(id: string): Promise<unknown>;
  create(campaignId: string, input: PlanMutationDto): Promise<unknown>;
  clone(id: string, actorId: string): Promise<unknown>;
  update(id: string, input: PlanMutationDto): Promise<unknown>;
  updateStatus(id: string, input: PlanStatusMutationDto): Promise<unknown>;
  delete(id: string): Promise<void>;
}

const objectId = (value?: string) => (value ? new Types.ObjectId(value) : undefined);
const trim = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const dateValue = (value: unknown, field: string) => {
  if (!value) return undefined;
  const date = new Date(value as string | Date);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} is invalid`);
  return date;
};
const allowedStatusTransitions: Record<PlanStatus, PlanStatus[]> = {
  Draft: ['Shared', 'Lost'],
  Shared: ['Negotiating', 'Won', 'Lost'],
  Negotiating: ['Won', 'Lost'],
  Won: [],
  Lost: [],
};

@injectable()
export class PlanService implements IPlanService {
  constructor(
    @inject(TOKENS.PlanRepository) private readonly repository: IPlanRepository,
    @inject(TOKENS.CampaignRepository) private readonly campaigns: ICampaignRepository,
    @inject(TOKENS.InventoryRepository) private readonly inventory: IInventoryRepository,
  ) {}

  async listByCampaign(campaignId: string) {
    this.validateId(campaignId, 'campaignId');
    return (await this.repository.findByCampaign(campaignId)).map(mapPlanToDto);
  }

  async listRecent() {
    return (await this.repository.findRecent(50)).map(mapPlanToDto);
  }

  async getById(id: string) {
    this.validateId(id, 'planId');
    const plan = await this.repository.findByIdPopulated(id);
    if (!plan) throw new HttpError(404, 'Plan not found');
    return mapPlanToDto(plan);
  }

  async create(campaignId: string, input: PlanMutationDto) {
    this.validateId(campaignId, 'campaignId');
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign) throw new HttpError(404, 'Campaign not found');
    if (campaign.status === 'Lost') throw new HttpError(400, 'Cannot create a plan for a lost campaign');
    const latest = await this.repository.findLatestByCampaign(campaignId);
    const versionNumber = (latest?.versionNumber || 0) + 1;
    const items = await this.prepareItems(input.items || []);
    const pricing = calculatePlanPricing(items, numberValue(input.taxPercentage));
    const plan = await this.repository.create({
      campaign: campaign._id,
      versionNumber,
      versionLabel: `v${versionNumber}`,
      title: trim(input.title) || `${campaign.title} - Plan v${versionNumber}`,
      status: 'Draft',
      isLocked: false,
      items,
      pricing,
      clientNotes: trim(input.clientNotes),
      internalNotes: trim(input.internalNotes),
      createdBy: objectId(input.createdBy),
      updatedBy: objectId(input.updatedBy),
    });
    return this.getById(plan._id.toString());
  }

  async clone(id: string, actorId: string) {
    const original = await this.getDocument(id);
    const campaignId = original.campaign.toString();
    const latest = await this.repository.findLatestByCampaign(campaignId);
    const versionNumber = (latest?.versionNumber || 0) + 1;
    const plan = await this.repository.create({
      campaign: original.campaign,
      versionNumber,
      versionLabel: `v${versionNumber}`,
      title: `${original.title.replace(/\s+-\s+Plan v\d+$/i, '')} - Plan v${versionNumber}`,
      status: 'Draft',
      isLocked: false,
      items: original.items.map((item) => item.toObject()),
      pricing: (original.pricing as any)?.toObject?.() || original.pricing,
      clientNotes: original.clientNotes,
      internalNotes: original.internalNotes,
      clonedFromPlan: original._id,
      createdBy: objectId(actorId),
      updatedBy: objectId(actorId),
    });
    return this.getById(plan._id.toString());
  }

  async update(id: string, input: PlanMutationDto) {
    const plan = await this.getDocument(id);
    if (plan.isLocked || plan.status !== 'Draft') {
      throw new HttpError(400, 'This plan version is locked. Clone it to make changes.');
    }
    if (input.title !== undefined) {
      const title = trim(input.title);
      if (!title) throw new HttpError(400, 'title is required');
      plan.title = title;
    }
    if (input.items !== undefined) {
      plan.items = (await this.prepareItems(input.items)) as any;
    }
    const taxPercentage =
      input.taxPercentage === undefined
        ? plan.pricing?.taxPercentage || 0
        : numberValue(input.taxPercentage);
    plan.pricing = calculatePlanPricing(plan.items as any, taxPercentage) as any;
    if (input.clientNotes !== undefined) plan.clientNotes = trim(input.clientNotes);
    if (input.internalNotes !== undefined) plan.internalNotes = trim(input.internalNotes);
    plan.updatedBy = objectId(input.updatedBy);
    await this.repository.save(plan);
    return this.getById(id);
  }

  async updateStatus(id: string, input: PlanStatusMutationDto) {
    const plan = await this.getDocument(id);
    if (!planStatuses.includes(input.status as PlanStatus)) {
      throw new HttpError(400, 'status is invalid');
    }
    const status = input.status as PlanStatus;
    if (
      status !== plan.status &&
      !allowedStatusTransitions[plan.status].includes(status)
    ) {
      throw new HttpError(400, `Cannot change plan status from ${plan.status} to ${status}`);
    }
    const actorId = objectId(input.actorId);
    plan.status = status;
    plan.updatedBy = actorId;
    if (status === 'Shared') {
      plan.isLocked = true;
      plan.sharedAt = new Date();
      plan.sharedBy = actorId;
      await this.setCampaignStatus(plan.campaign.toString(), 'Plan Shared', actorId);
    } else if (status === 'Negotiating') {
      await this.setCampaignStatus(plan.campaign.toString(), 'Negotiating', actorId);
    } else if (status === 'Won') {
      plan.isLocked = true;
      plan.wonAt = new Date();
      await this.setCampaignStatus(plan.campaign.toString(), 'Won', actorId);
    } else if (status === 'Lost') {
      plan.isLocked = true;
      plan.lostAt = new Date();
      await this.setCampaignStatus(plan.campaign.toString(), 'Lost', actorId);
    }
    await this.repository.save(plan);
    return this.getById(id);
  }

  async delete(id: string) {
    const plan = await this.getDocument(id);
    if (plan.status !== 'Draft' || plan.isLocked) {
      throw new HttpError(400, 'Only unlocked draft plans can be deleted');
    }
    await this.repository.deleteById(id);
  }

  private async setCampaignStatus(
    campaignId: string,
    status: string,
    actorId?: Types.ObjectId,
  ) {
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign) return;
    if (status === 'Plan Shared' && ['Won', 'Lost'].includes(campaign.status)) return;
    campaign.status = status as any;
    campaign.updatedBy = actorId;
    await this.campaigns.save(campaign);
  }

  private async prepareItems(inputs: PlanItemInputDto[]) {
    return Promise.all(
      inputs.map(async (input) => {
        if (!input.inventory || !Types.ObjectId.isValid(input.inventory)) {
          throw new HttpError(400, 'inventory is required for every plan item');
        }
        const inventory = await this.inventory.findById(input.inventory);
        if (!inventory) throw new HttpError(404, 'Inventory item not found');
        if (
          inventory.status !== 'active' ||
          inventory.availabilityStatus === 'booked' ||
          getConfirmationStatus(inventory) !== 'fresh'
        ) {
          throw new HttpError(400, 'Inventory must be confirmed before adding to a plan.');
        }
        const startDate = dateValue(input.startDate, 'startDate');
        const endDate = dateValue(input.endDate, 'endDate');
        if (startDate && endDate && endDate < startDate) {
          throw new HttpError(400, 'Plan item endDate cannot be before startDate');
        }
        return calculatePlanItem({
          inventory: inventory._id,
          inventoryCode: inventory.inventoryCode,
          title: inventory.title,
          categoryGroup: getEffectiveCategoryGroup(inventory),
          subCategory: getEffectiveSubCategory(inventory),
          city: inventory.city,
          area: inventory.area,
          width: inventory.width,
          height: inventory.height,
          totalSqFt: inventory.totalSqFt,
          startDate,
          endDate,
          quantity: numberValue(input.quantity, 1),
          unitSellingPrice: numberValue(input.unitSellingPrice),
          unitInternalCost: numberValue(input.unitInternalCost),
          notes: trim(input.notes),
        });
      }),
    );
  }

  private async getDocument(id: string) {
    this.validateId(id, 'planId');
    const plan = await this.repository.findById(id);
    if (!plan) throw new HttpError(404, 'Plan not found');
    return plan;
  }

  private validateId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, `${field} is invalid`);
  }
}
