import { injectable } from 'tsyringe';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { CampaignCounterModel } from '../models/campaignCounter.model.js';
import type { CampaignCounterDocument } from '../models/campaignCounter.model.js';

export interface ICampaignCounterRepository extends IBaseRepository<CampaignCounterDocument> {
  findByKey(key: string): Promise<CampaignCounterDocument | null>;
  incrementSequence(key: string, year: number): Promise<CampaignCounterDocument>;
}

@injectable()
export class CampaignCounterRepository
  extends BaseRepository<CampaignCounterDocument>
  implements ICampaignCounterRepository
{
  constructor() {
    super(CampaignCounterModel);
  }

  findByKey(key: string) {
    return this.findOne({ key });
  }

  async incrementSequence(key: string, year: number) {
    const counter = await CampaignCounterModel.findOneAndUpdate(
      { key },
      { $inc: { sequence: 1 }, $setOnInsert: { key, year } },
      { new: true, upsert: true },
    ).exec();
    return counter as CampaignCounterDocument;
  }
}
