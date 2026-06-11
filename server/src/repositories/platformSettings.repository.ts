import { injectable } from 'tsyringe';

import { PlatformSettingsModel } from '../models/platformSettings.model.js';
import type { PlatformSettingsDocument } from '../models/platformSettings.model.js';
import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';

export interface IPlatformSettingsRepository
  extends IBaseRepository<PlatformSettingsDocument> {
  findDefault(): Promise<PlatformSettingsDocument | null>;
}

@injectable()
export class PlatformSettingsRepository
  extends BaseRepository<PlatformSettingsDocument>
  implements IPlatformSettingsRepository {
  constructor() {
    super(PlatformSettingsModel);
  }

  findDefault() {
    return this.findOne({ key: 'default' });
  }
}
