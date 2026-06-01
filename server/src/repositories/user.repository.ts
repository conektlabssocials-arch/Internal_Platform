import { injectable } from 'tsyringe';
import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { UserModel } from '../models/user.model.js';
import type { UserDocument } from '../models/user.model.js';

export interface IUserRepository extends IBaseRepository<UserDocument> {
  findAllSortedByCreatedAt(): Promise<UserDocument[]>;
  findByEmail(email: string): Promise<UserDocument | null>;
  findDuplicateEmail(email: string, excludedUserId: string): Promise<UserDocument | null>;
}

@injectable()
export class UserRepository extends BaseRepository<UserDocument> implements IUserRepository {
  constructor() {
    super(UserModel);
  }

  findAllSortedByCreatedAt() {
    return this.model.find().sort({ createdAt: -1 }).exec() as Promise<UserDocument[]>;
  }

  findByEmail(email: string) {
    return this.findOne({ email });
  }

  findDuplicateEmail(email: string, excludedUserId: string) {
    return this.findOne({
      email,
      _id: { $ne: excludedUserId },
    });
  }
}
