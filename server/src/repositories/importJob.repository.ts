import { injectable } from 'tsyringe';
import type { FilterQuery } from 'mongoose';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { ImportJobModel } from '../models/importJob.model.js';
import type { ImportJobDocument } from '../models/importJob.model.js';

export interface IImportJobRepository extends IBaseRepository<ImportJobDocument> {
  findByIdWithUploader(id: string): Promise<ImportJobDocument | null>;
  findPaginated(
    filter: FilterQuery<unknown>,
    page: number,
    limit: number,
  ): Promise<{ items: ImportJobDocument[]; total: number }>;
}

@injectable()
export class ImportJobRepository
  extends BaseRepository<ImportJobDocument>
  implements IImportJobRepository
{
  constructor() {
    super(ImportJobModel);
  }

  findByIdWithUploader(id: string) {
    return this.model
      .findById(id)
      .populate('uploadedBy', 'name email')
      .exec() as Promise<ImportJobDocument | null>;
  }

  async findPaginated(filter: FilterQuery<unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('uploadedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { items: items as ImportJobDocument[], total };
  }
}
