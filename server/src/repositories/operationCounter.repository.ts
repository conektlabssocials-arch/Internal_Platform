import { injectable } from 'tsyringe';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { OperationCounterModel } from '../models/operationCounter.model.js';
import type { OperationCounterDocument } from '../models/operationCounter.model.js';

export interface IOperationCounterRepository
  extends IBaseRepository<OperationCounterDocument> {
  incrementSequence(key: string, year: number): Promise<OperationCounterDocument>;
}

@injectable()
export class OperationCounterRepository
  extends BaseRepository<OperationCounterDocument>
  implements IOperationCounterRepository
{
  constructor() {
    super(OperationCounterModel);
  }

  async incrementSequence(key: string, year: number) {
    return (await OperationCounterModel.findOneAndUpdate(
      { key },
      { $inc: { sequence: 1 }, $setOnInsert: { key, year } },
      { new: true, upsert: true },
    ).exec()) as OperationCounterDocument;
  }
}
