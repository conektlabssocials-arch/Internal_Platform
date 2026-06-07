import { injectable } from 'tsyringe';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { PlanModel } from '../models/plan.model.js';
import type { PlanDocument } from '../models/plan.model.js';

const populatePlan = (query: any) =>
  query
    .populate({
      path: 'campaign',
      populate: { path: 'client', select: 'name displayName email phone entityType' },
    })
    .populate('items.inventory')
    .populate('createdBy', 'name email role')
    .populate('updatedBy', 'name email role')
    .populate('sharedBy', 'name email role');

export interface IPlanRepository extends IBaseRepository<PlanDocument> {
  findByCampaign(campaignId: string): Promise<PlanDocument[]>;
  findLatestByCampaign(campaignId: string): Promise<PlanDocument | null>;
  findByIdPopulated(id: string): Promise<PlanDocument | null>;
  findRecent(limit: number): Promise<PlanDocument[]>;
  deleteById(id: string): Promise<PlanDocument | null>;
}

@injectable()
export class PlanRepository extends BaseRepository<PlanDocument> implements IPlanRepository {
  constructor() {
    super(PlanModel);
  }

  findByCampaign(campaignId: string) {
    return populatePlan(
      this.model.find({ campaign: campaignId }).sort({ versionNumber: -1 }),
    ).exec() as Promise<PlanDocument[]>;
  }

  findLatestByCampaign(campaignId: string) {
    return this.model
      .findOne({ campaign: campaignId })
      .sort({ versionNumber: -1 })
      .exec() as Promise<PlanDocument | null>;
  }

  findByIdPopulated(id: string) {
    return populatePlan(this.model.findById(id)).exec() as Promise<PlanDocument | null>;
  }

  findRecent(limit: number) {
    return populatePlan(this.model.find().sort({ updatedAt: -1 }).limit(limit)).exec() as Promise<
      PlanDocument[]
    >;
  }

  deleteById(id: string) {
    return this.model.findByIdAndDelete(id).exec() as Promise<PlanDocument | null>;
  }
}
