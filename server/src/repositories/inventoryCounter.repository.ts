import { injectable } from 'tsyringe';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { InventoryCounterModel } from '../models/inventoryCounter.model.js';
import type { InventoryCounterDocument } from '../models/inventoryCounter.model.js';

type CounterInput = {
  key: string;
  category: string;
  cityCode: string;
  areaCode: string;
};

export interface IInventoryCounterRepository extends IBaseRepository<InventoryCounterDocument> {
  findByKey(key: string): Promise<InventoryCounterDocument | null>;
  incrementSequence(input: CounterInput): Promise<InventoryCounterDocument>;
}

@injectable()
export class InventoryCounterRepository
  extends BaseRepository<InventoryCounterDocument>
  implements IInventoryCounterRepository
{
  constructor() {
    super(InventoryCounterModel);
  }

  findByKey(key: string) {
    return this.findOne({ key });
  }

  async incrementSequence(input: CounterInput) {
    const counter = await InventoryCounterModel.findOneAndUpdate(
      { key: input.key },
      {
        $inc: { sequence: 1 },
        $setOnInsert: {
          key: input.key,
          category: input.category,
          cityCode: input.cityCode,
          areaCode: input.areaCode,
        },
      },
      {
        new: true,
        upsert: true,
      },
    ).exec();

    return counter as InventoryCounterDocument;
  }
}
