import { injectable } from 'tsyringe';
import type { FilterQuery } from 'mongoose';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { CrmEntityModel } from '../models/crmEntity.model.js';
import type { CrmEntityDocument } from '../models/crmEntity.model.js';

export interface ICrmEntityRepository extends IBaseRepository<CrmEntityDocument> {
  findPaginated(
    filter: FilterQuery<unknown>,
    page: number,
    limit: number,
  ): Promise<{ items: CrmEntityDocument[]; total: number }>;
  findActiveSuppliers(search?: string, limit?: number): Promise<CrmEntityDocument[]>;
  getSummary(): Promise<
    { entityType: string; total: number; active: number; inactive: number }[]
  >;
  findDuplicate(
    values: { email?: string; gstNumber?: string; panNumber?: string },
    excludedEntityId?: string,
  ): Promise<CrmEntityDocument | null>;
}

@injectable()
export class CrmEntityRepository
  extends BaseRepository<CrmEntityDocument>
  implements ICrmEntityRepository
{
  constructor() {
    super(CrmEntityModel);
  }

  async findPaginated(filter: FilterQuery<unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { items: items as CrmEntityDocument[], total };
  }

  findActiveSuppliers(search?: string, limit = 20) {
    const filter: FilterQuery<unknown> = {
      entityType: 'SupplierOwner',
      status: 'active',
    };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { name: searchRegex },
        { displayName: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ];
    }

    return this.model.find(filter).sort({ name: 1 }).limit(limit).exec() as Promise<
      CrmEntityDocument[]
    >;
  }

  getSummary() {
    return this.model
      .aggregate<{
        entityType: string;
        total: number;
        active: number;
        inactive: number;
      }>([
        {
          $group: {
            _id: '$entityType',
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
            inactive: {
              $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            entityType: '$_id',
            total: 1,
            active: 1,
            inactive: 1,
          },
        },
      ])
      .exec();
  }

  findDuplicate(
    values: { email?: string; gstNumber?: string; panNumber?: string },
    excludedEntityId?: string,
  ) {
    const duplicateFields = Object.entries(values)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([field, value]) => ({ [field]: value }));

    if (duplicateFields.length === 0) {
      return Promise.resolve(null);
    }

    const filter: FilterQuery<unknown> = { $or: duplicateFields };

    if (excludedEntityId) {
      filter._id = { $ne: excludedEntityId };
    }

    return this.model.findOne(filter).exec() as Promise<CrmEntityDocument | null>;
  }
}
