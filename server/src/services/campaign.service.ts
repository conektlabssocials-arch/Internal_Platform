import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import { mapCampaignToDto } from '../dto/campaign.dto.js';
import type {
  CampaignFiltersDto,
  CampaignMutationDto,
  CampaignStatusMutationDto,
} from '../dto/campaign.dto.js';
import {
  campaignBudgetTypes,
  campaignCategories,
  campaignClientTypes,
  campaignPriorities,
  campaignSources,
  campaignStatuses,
} from '../models/campaign.model.js';
import type {
  CampaignCategory,
  CampaignDocument,
  CampaignStatus,
} from '../models/campaign.model.js';
import type { ICampaignCounterRepository } from '../repositories/campaignCounter.repository.js';
import type { ICampaignRepository } from '../repositories/campaign.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { IUserRepository } from '../repositories/user.repository.js';
import { formatCampaignCode, getCampaignCounterKey } from '../utils/campaignCode.js';
import { HttpError } from '../utils/httpError.js';

export interface ICampaignService {
  previewCode(): Promise<string>;
  listCampaigns(filters: CampaignFiltersDto): Promise<unknown>;
  getSummary(): Promise<unknown>;
  getCampaignById(id: string): Promise<unknown>;
  createCampaign(input: CampaignMutationDto): Promise<unknown>;
  updateCampaign(id: string, input: CampaignMutationDto): Promise<unknown>;
  updateStatus(id: string, input: CampaignStatusMutationDto): Promise<unknown>;
}

const trim = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const objectId = (value?: string) => (value ? new Types.ObjectId(value) : undefined);
const numberValue = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const dateValue = (value: unknown, field: string) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const date = new Date(value as string | Date);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} is invalid`);
  return date;
};
const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : undefined;
const enumValue = <T extends string>(value: unknown, allowed: readonly T[], field: string) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (!allowed.includes(value as T)) throw new HttpError(400, `${field} is invalid`);
  return value as T;
};
const pageValue = (value?: string) => Math.max(Math.floor(Number(value) || 1), 1);
const limitValue = (value?: string) => Math.min(Math.max(Math.floor(Number(value) || 20), 1), 100);
const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};
const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

@injectable()
export class CampaignService implements ICampaignService {
  constructor(
    @inject(TOKENS.CampaignRepository) private readonly repository: ICampaignRepository,
    @inject(TOKENS.CampaignCounterRepository)
    private readonly counterRepository: ICampaignCounterRepository,
    @inject(TOKENS.CrmEntityRepository)
    private readonly crmRepository: ICrmEntityRepository,
    @inject(TOKENS.UserRepository) private readonly userRepository: IUserRepository,
  ) {}

  async previewCode() {
    const year = new Date().getFullYear();
    const counter = await this.counterRepository.findByKey(getCampaignCounterKey(year));
    return formatCampaignCode(year, (counter?.sequence || 0) + 1);
  }

  async listCampaigns(filters: CampaignFiltersDto) {
    const page = pageValue(filters.page);
    const limit = limitValue(filters.limit);
    const filter = await this.buildFilter(filters);
    const { items, total } = await this.repository.findPaginated(filter, page, limit);
    return {
      data: items.map(mapCampaignToDto),
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    };
  }

  async getSummary() {
    const items = await this.repository.findAll();
    const openStatuses: CampaignStatus[] = ['New', 'In Discussion', 'Plan Shared', 'Negotiating', 'On Hold'];
    const value = (item: CampaignDocument) =>
      item.expectedRevenue ?? item.budget?.fixed ?? item.budget?.max ?? 0;
    const count = (status: CampaignStatus) => items.filter((item) => item.status === status).length;
    return {
      total: items.length,
      new: count('New'),
      inDiscussion: count('In Discussion'),
      planShared: count('Plan Shared'),
      negotiating: count('Negotiating'),
      won: count('Won'),
      lost: count('Lost'),
      onHold: count('On Hold'),
      openPipelineValue: items.filter((item) => openStatuses.includes(item.status)).reduce((sum, item) => sum + value(item), 0),
      wonValue: items.filter((item) => item.status === 'Won').reduce((sum, item) => sum + value(item), 0),
      followUpsDueToday: items.filter(
        (item) =>
          item.nextFollowUpAt &&
          item.nextFollowUpAt <= endOfToday() &&
          !['Won', 'Lost'].includes(item.status),
      ).length,
    };
  }

  async getCampaignById(id: string) {
    this.validateId(id);
    const item = await this.repository.findByIdPopulated(id);
    if (!item) throw new HttpError(404, 'Campaign not found');
    return mapCampaignToDto(item);
  }

  async createCampaign(input: CampaignMutationDto) {
    const data = await this.prepareMutation(input, true);
    const year = new Date().getFullYear();
    const counter = await this.counterRepository.incrementSequence(
      getCampaignCounterKey(year),
      year,
    );
    const item = await this.repository.create({
      ...data,
      campaignCode: formatCampaignCode(year, counter.sequence),
    });
    return this.getCampaignById(item._id.toString());
  }

  async updateCampaign(id: string, input: CampaignMutationDto) {
    const item = await this.getDocument(id);
    const data = await this.prepareMutation(input, false);
    Object.assign(item, data);
    await this.repository.save(item);
    return this.getCampaignById(id);
  }

  async updateStatus(id: string, input: CampaignStatusMutationDto) {
    const item = await this.getDocument(id);
    const status = enumValue(input.status, campaignStatuses, 'status');
    if (!status) throw new HttpError(400, 'status is required');
    const reason = trim(input.reason);
    if (status === 'Lost' && !reason) throw new HttpError(400, 'Lost reason is required');
    item.status = status;
    if (status === 'Lost') item.lostReason = reason;
    if (status === 'On Hold') item.onHoldReason = reason;
    item.updatedBy = objectId(input.updatedBy);
    await this.repository.save(item);
    return this.getCampaignById(id);
  }

  private async getDocument(id: string) {
    this.validateId(id);
    const item = await this.repository.findById(id);
    if (!item) throw new HttpError(404, 'Campaign not found');
    return item;
  }

  private validateId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Campaign id is invalid');
  }

  private async validateClient(id?: string) {
    if (!id || !Types.ObjectId.isValid(id)) throw new HttpError(400, 'client is required');
    const client = await this.crmRepository.findById(id);
    if (!client) throw new HttpError(404, 'Campaign client not found');
    if (!campaignClientTypes.includes(client.entityType as any)) {
      throw new HttpError(400, 'Supplier / Owner cannot be used as a campaign client');
    }
    return client;
  }

  private async validateOwner(id?: string) {
    if (!id || !Types.ObjectId.isValid(id)) throw new HttpError(400, 'ownerUser is invalid');
    const owner = await this.userRepository.findById(id);
    if (!owner || owner.status !== 'active') throw new HttpError(400, 'Campaign owner must be an active user');
    return owner;
  }

  private async prepareMutation(input: CampaignMutationDto, create: boolean) {
    const title = trim(input.title);
    const brief = trim(input.brief);
    const source = enumValue(input.source, campaignSources, 'source');
    if (create && (!title || !brief || !source || !input.client)) {
      throw new HttpError(400, 'title, client, source, and brief are required');
    }
    const data: Record<string, unknown> = {
      title: input.title === undefined ? undefined : title,
      agencyBrandName: input.agencyBrandName === undefined ? undefined : trim(input.agencyBrandName) || null,
      source,
      brief: input.brief === undefined ? undefined : brief,
      objective: input.objective === undefined ? undefined : trim(input.objective) || null,
      budgetType: enumValue(input.budgetType, campaignBudgetTypes, 'budgetType'),
      budget: input.budget
        ? { min: numberValue(input.budget.min), max: numberValue(input.budget.max), fixed: numberValue(input.budget.fixed) }
        : undefined,
      startDate: dateValue(input.startDate, 'startDate'),
      endDate: dateValue(input.endDate, 'endDate'),
      geos: stringArray(input.geos),
      targetAudience: input.targetAudience === undefined ? undefined : trim(input.targetAudience) || null,
      categoriesOfInterest: this.validateCategories(input.categoriesOfInterest),
      expectedRevenue: numberValue(input.expectedRevenue),
      priority: enumValue(input.priority, campaignPriorities, 'priority'),
      nextFollowUpAt: dateValue(input.nextFollowUpAt, 'nextFollowUpAt'),
      notes: input.notes === undefined ? undefined : trim(input.notes) || null,
      tags: stringArray(input.tags),
      updatedBy: objectId(input.updatedBy),
    };
    if (input.client) {
      const client = await this.validateClient(input.client);
      data.client = client._id;
      data.clientType = client.entityType;
    }
    if (input.ownerUser) {
      const owner = await this.validateOwner(input.ownerUser);
      data.ownerUser = owner._id;
    }
    if (create) {
      data.ownerUser = data.ownerUser || objectId(input.createdBy);
      await this.validateOwner((data.ownerUser as Types.ObjectId).toString());
      data.createdBy = objectId(input.createdBy);
      data.status = 'New';
      data.budgetType = data.budgetType || 'unknown';
      data.priority = data.priority || 'Medium';
    }
    const start = data.startDate as Date | undefined;
    const end = data.endDate as Date | undefined;
    if (start && end && end < start) throw new HttpError(400, 'endDate cannot be before startDate');
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    return data;
  }

  private validateCategories(value: unknown) {
    const categories = stringArray(value);
    if (!categories) return undefined;
    for (const category of categories) {
      if (!campaignCategories.includes(category as CampaignCategory)) {
        throw new HttpError(400, 'categoriesOfInterest contains an invalid category');
      }
    }
    return categories;
  }

  private async buildFilter(filters: CampaignFiltersDto) {
    const filter: FilterQuery<unknown> = {};
    if (filters.status) filter.status = enumValue(filters.status, campaignStatuses, 'status');
    if (filters.client) filter.client = objectId(filters.client);
    if (filters.clientType) filter.clientType = enumValue(filters.clientType, campaignClientTypes, 'clientType');
    if (filters.source) filter.source = enumValue(filters.source, campaignSources, 'source');
    if (filters.ownerUser) filter.ownerUser = objectId(filters.ownerUser);
    if (filters.category) filter.categoriesOfInterest = enumValue(filters.category, campaignCategories, 'category');
    if (filters.priority) filter.priority = enumValue(filters.priority, campaignPriorities, 'priority');
    if (filters.geo || filters.city) filter.geos = new RegExp(filters.geo || filters.city || '', 'i');
    if (filters.startDateFrom || filters.startDateTo) {
      filter.startDate = {
        ...(filters.startDateFrom ? { $gte: dateValue(filters.startDateFrom, 'startDateFrom') } : {}),
        ...(filters.startDateTo ? { $lte: dateValue(filters.startDateTo, 'startDateTo') } : {}),
      };
    }
    if (filters.followUpFrom || filters.followUpTo || filters.followUpDue === 'true') {
      filter.nextFollowUpAt = filters.followUpDue === 'true'
        ? { $lte: endOfToday() }
        : {
            ...(filters.followUpFrom ? { $gte: dateValue(filters.followUpFrom, 'followUpFrom') } : {}),
            ...(filters.followUpTo ? { $lte: dateValue(filters.followUpTo, 'followUpTo') } : {}),
          };
      if (filters.followUpDue === 'true') filter.status = { $nin: ['Won', 'Lost'] };
    }
    const search = trim(filters.search);
    if (search) {
      const regex = new RegExp(search, 'i');
      const clients = await this.crmRepository.find({
        $or: [{ name: regex }, { displayName: regex }],
      });
      filter.$or = [
        { campaignCode: regex },
        { title: regex },
        { brief: regex },
        { notes: regex },
        { geos: regex },
        { tags: regex },
        { client: { $in: clients.map((client) => client._id) } },
      ];
    }
    return filter;
  }
}
