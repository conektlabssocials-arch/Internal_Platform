import { injectable } from 'tsyringe';
import type { FilterQuery } from 'mongoose';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { UploadModel } from '../models/upload.model.js';
import type { UploadDocument } from '../models/upload.model.js';

export interface IUploadRepository extends IBaseRepository<UploadDocument> {
  findActiveById(id: string): Promise<UploadDocument | null>;
  findFiltered(filter: FilterQuery<unknown>): Promise<UploadDocument[]>;
  hardDelete(id: string): Promise<void>;
}

@injectable()
export class UploadRepository
  extends BaseRepository<UploadDocument>
  implements IUploadRepository
{
  constructor() {
    super(UploadModel);
  }

  findActiveById(id: string) {
    return this.findOne({ _id: id, status: 'active' });
  }

  findFiltered(filter: FilterQuery<unknown>) {
    return this.model
      .find(filter)
      .populate('uploadedBy', 'name email role')
      .sort({ createdAt: -1 })
      .exec() as Promise<UploadDocument[]>;
  }

  async hardDelete(id: string) {
    await this.model.deleteOne({ _id: id }).exec();
  }
}
