import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import {
  DEFAULT_MEMBER_PERMISSIONS,
  MEMBER_PERMISSION_FIELDS,
  MEMBER_PERMISSION_KEYS,
} from '../models/platformSettings.model.js';
import type {
  MemberPermission,
  PlatformSettingsDocument,
} from '../models/platformSettings.model.js';
import type { IPlatformSettingsRepository } from '../repositories/platformSettings.repository.js';
import type { UserRole } from '../models/user.model.js';
import { HttpError } from '../utils/httpError.js';

export type PlatformSettingsDto = {
  memberPermissions: Record<MemberPermission, boolean>;
  updatedAt?: Date;
};

export interface IPlatformSettingsService {
  getSettings(): Promise<PlatformSettingsDto>;
  getEffectivePermissions(role: UserRole): Promise<Record<MemberPermission, boolean>>;
  hasPermission(role: UserRole, permission: MemberPermission): Promise<boolean>;
  updateMemberPermissions(
    input: Partial<Record<MemberPermission, boolean>>,
    updatedBy: string,
  ): Promise<PlatformSettingsDto>;
}

const toDto = (settings?: PlatformSettingsDocument | null): PlatformSettingsDto => {
  const stored = settings?.memberPermissions as unknown as Record<string, boolean> | undefined;
  return {
    memberPermissions: Object.fromEntries(
      MEMBER_PERMISSION_KEYS.map((permission) => [
        permission,
        stored?.[MEMBER_PERMISSION_FIELDS[permission]]
          ?? DEFAULT_MEMBER_PERMISSIONS[permission],
      ]),
    ) as Record<MemberPermission, boolean>,
    updatedAt: settings?.updatedAt,
  };
};

@injectable()
export class PlatformSettingsService implements IPlatformSettingsService {
  constructor(
    @inject(TOKENS.PlatformSettingsRepository)
    private readonly repository: IPlatformSettingsRepository,
  ) {}

  async getSettings() {
    return toDto(await this.repository.findDefault());
  }

  async getEffectivePermissions(role: UserRole) {
    if (role === 'admin') {
      return Object.fromEntries(
        MEMBER_PERMISSION_KEYS.map((permission) => [permission, true]),
      ) as Record<MemberPermission, boolean>;
    }
    return (await this.getSettings()).memberPermissions;
  }

  async hasPermission(role: UserRole, permission: MemberPermission) {
    if (role === 'admin') return true;
    return (await this.getEffectivePermissions(role))[permission];
  }

  async updateMemberPermissions(
    input: Partial<Record<MemberPermission, boolean>>,
    updatedBy: string,
  ) {
    const invalid = Object.keys(input).find(
      (key) => !MEMBER_PERMISSION_KEYS.includes(key as MemberPermission),
    );
    if (invalid) throw new HttpError(400, `Unknown permission: ${invalid}`);

    const current = await this.repository.findDefault();
    const next = {
      ...(await this.getSettings()).memberPermissions,
      ...Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, Boolean(value)]),
      ),
    };
    const storedPermissions = Object.fromEntries(
      MEMBER_PERMISSION_KEYS.map((permission) => [
        MEMBER_PERMISSION_FIELDS[permission],
        next[permission],
      ]),
    );

    if (current) {
      current.memberPermissions = storedPermissions;
      current.updatedBy = new Types.ObjectId(updatedBy);
      return toDto(await this.repository.save(current));
    }

    return toDto(await this.repository.create({
      key: 'default',
      memberPermissions: storedPermissions,
      updatedBy: new Types.ObjectId(updatedBy),
    }));
  }
}
