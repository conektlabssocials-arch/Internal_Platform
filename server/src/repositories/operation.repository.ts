import { injectable } from 'tsyringe';
import type { FilterQuery } from 'mongoose';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { OperationModel } from '../models/operation.model.js';
import type { OperationDocument } from '../models/operation.model.js';

const populateOperation = (query: any) =>
  query
    .populate('operationOwner', 'name email role')
    .populate('campaign', 'campaignCode title')
    .populate('plan', 'versionNumber versionLabel title status')
    .populate('client', 'displayName name')
    .populate('createdBy', 'name email role')
    .populate('updatedBy', 'name email role');

export interface IOperationRepository extends IBaseRepository<OperationDocument> {
  findByPlan(planId: string): Promise<OperationDocument | null>;
  findByIdPopulated(id: string): Promise<OperationDocument | null>;
  findPaginated(
    filter: FilterQuery<unknown>,
    page: number,
    limit: number,
  ): Promise<{ items: OperationDocument[]; total: number }>;
  findAll(): Promise<OperationDocument[]>;
}

@injectable()
export class OperationRepository
  extends BaseRepository<OperationDocument>
  implements IOperationRepository
{
  constructor() {
    super(OperationModel);
  }

  findByPlan(planId: string) {
    return populateOperation(
      this.model.findOne({ plan: planId }),
    ).exec() as Promise<OperationDocument | null>;
  }

  findByIdPopulated(id: string) {
    return populateOperation(this.model.findById(id)).exec() as Promise<OperationDocument | null>;
  }

  async findPaginated(filter: FilterQuery<unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      populateOperation(
        this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items: items as OperationDocument[], total };
  }

  findAll() {
    return this.model.find().exec() as Promise<OperationDocument[]>;
  }
}
