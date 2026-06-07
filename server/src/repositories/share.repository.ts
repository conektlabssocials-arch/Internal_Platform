import { injectable } from 'tsyringe';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { ShareModel } from '../models/share.model.js';
import type { ShareDocument } from '../models/share.model.js';

const populateInternal = (query: any) =>
  query.populate('createdBy', 'name email role');

const populatePublic = (query: any) =>
  query.populate({
    path: 'plan',
    populate: {
      path: 'campaign',
      populate: { path: 'client', select: 'name displayName' },
    },
  });

export interface IShareRepository extends IBaseRepository<ShareDocument> {
  findByPlan(planId: string): Promise<ShareDocument[]>;
  findByIdPopulated(id: string): Promise<ShareDocument | null>;
  findByTokenPopulated(token: string): Promise<ShareDocument | null>;
  recordView(id: string, viewedAt: Date): Promise<void>;
  recordMapOpened(id: string, interactedAt: Date): Promise<void>;
  recordPinClick(
    id: string,
    pin: { inventoryCode?: string; title?: string; clickedAt: Date },
  ): Promise<void>;
}

@injectable()
export class ShareRepository
  extends BaseRepository<ShareDocument>
  implements IShareRepository
{
  constructor() {
    super(ShareModel);
  }

  findByPlan(planId: string) {
    return populateInternal(
      this.model.find({ plan: planId }).sort({ createdAt: -1 }),
    ).exec() as Promise<ShareDocument[]>;
  }

  findByIdPopulated(id: string) {
    return populateInternal(this.model.findById(id)).exec() as Promise<ShareDocument | null>;
  }

  findByTokenPopulated(token: string) {
    return populatePublic(this.model.findOne({ token })).exec() as Promise<ShareDocument | null>;
  }

  async recordView(id: string, viewedAt: Date) {
    await this.model
      .updateOne(
        { _id: id, status: 'active' },
        { $inc: { viewCount: 1 }, $set: { lastViewedAt: viewedAt } },
      )
      .exec();
  }

  async recordMapOpened(id: string, interactedAt: Date) {
    await this.model
      .updateOne(
        { _id: id, status: 'active' },
        {
          $inc: { 'mapTracking.mapOpenedCount': 1 },
          $set: { 'mapTracking.lastMapInteractionAt': interactedAt },
        },
      )
      .exec();
  }

  async recordPinClick(
    id: string,
    pin: { inventoryCode?: string; title?: string; clickedAt: Date },
  ) {
    await this.model
      .updateOne(
        { _id: id, status: 'active' },
        {
          $inc: { 'mapTracking.pinClickCount': 1 },
          $push: {
            'mapTracking.clickedPins': {
              $each: [pin],
              $slice: -200,
            },
          },
          $set: { 'mapTracking.lastMapInteractionAt': pin.clickedAt },
        },
      )
      .exec();
  }
}
