import { injectable } from 'tsyringe';
import type { FilterQuery } from 'mongoose';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { CampaignModel } from '../models/campaign.model.js';
import type { CampaignDocument } from '../models/campaign.model.js';

const populateCampaign = (query: any) =>
  query
    .populate('client', 'name displayName email phone entityType')
    .populate('ownerUser', 'name email role');

export interface ICampaignRepository extends IBaseRepository<CampaignDocument> {
  findPaginated(
    filter: FilterQuery<unknown>,
    page: number,
    limit: number,
  ): Promise<{ items: CampaignDocument[]; total: number }>;
  findByIdPopulated(id: string): Promise<CampaignDocument | null>;
  findAll(): Promise<CampaignDocument[]>;
}

@injectable()
export class CampaignRepository
  extends BaseRepository<CampaignDocument>
  implements ICampaignRepository
{
  constructor() {
    super(CampaignModel);
  }

  async findPaginated(filter: FilterQuery<unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      populateCampaign(
        this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items: items as CampaignDocument[], total };
  }

  findByIdPopulated(id: string) {
    return populateCampaign(this.model.findById(id)).exec() as Promise<CampaignDocument | null>;
  }

  findAll() {
    return this.model.find().exec() as Promise<CampaignDocument[]>;
  }
}
