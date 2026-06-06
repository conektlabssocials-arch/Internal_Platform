import { injectable } from 'tsyringe';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { ContactModel } from '../models/contact.model.js';
import type { ContactDocument } from '../models/contact.model.js';

export interface IContactRepository extends IBaseRepository<ContactDocument> {
  findByEntity(entityId: string): Promise<ContactDocument[]>;
  findPrimaryByEntities(entityIds: string[]): Promise<ContactDocument[]>;
  unsetPrimaryForEntity(entityId: string, excludedContactId?: string): Promise<void>;
  deleteById(id: string): Promise<ContactDocument | null>;
}

@injectable()
export class ContactRepository
  extends BaseRepository<ContactDocument>
  implements IContactRepository
{
  constructor() {
    super(ContactModel);
  }

  findByEntity(entityId: string) {
    return this.model
      .find({ crmEntity: entityId })
      .sort({ isPrimary: -1, createdAt: -1 })
      .exec() as Promise<ContactDocument[]>;
  }

  findPrimaryByEntities(entityIds: string[]) {
    return this.model
      .find({ crmEntity: { $in: entityIds }, isPrimary: true })
      .exec() as Promise<ContactDocument[]>;
  }

  async unsetPrimaryForEntity(entityId: string, excludedContactId?: string) {
    const filter: Record<string, unknown> = {
      crmEntity: entityId,
      isPrimary: true,
    };

    if (excludedContactId) {
      filter._id = { $ne: excludedContactId };
    }

    await this.model.updateMany(filter, { $set: { isPrimary: false } }).exec();
  }

  deleteById(id: string) {
    return this.model.findByIdAndDelete(id).exec() as Promise<ContactDocument | null>;
  }
}
