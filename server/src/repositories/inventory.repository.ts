import { injectable } from 'tsyringe';
import type { FilterQuery } from 'mongoose';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { InventoryModel } from '../models/inventory.model.js';
import type { InventoryDocument } from '../models/inventory.model.js';

export type InventoryListResult = {
  items: InventoryDocument[];
  total: number;
};

export interface IInventoryRepository extends IBaseRepository<InventoryDocument> {
  findByInventoryCode(inventoryCode: string): Promise<InventoryDocument | null>;
  findDuplicateInventoryCode(
    inventoryCode: string,
    excludedInventoryId: string,
  ): Promise<InventoryDocument | null>;
  findPaginated(
    filter: FilterQuery<unknown>,
    page: number,
    limit: number,
  ): Promise<InventoryListResult>;
}

@injectable()
export class InventoryRepository
  extends BaseRepository<InventoryDocument>
  implements IInventoryRepository
{
  constructor() {
    super(InventoryModel);
  }

  findByInventoryCode(inventoryCode: string) {
    return this.findOne({ inventoryCode });
  }

  findDuplicateInventoryCode(inventoryCode: string, excludedInventoryId: string) {
    return this.findOne({
      inventoryCode,
      _id: { $ne: excludedInventoryId },
    });
  }

  async findPaginated(filter: FilterQuery<unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      items: items as InventoryDocument[],
      total,
    };
  }
}
