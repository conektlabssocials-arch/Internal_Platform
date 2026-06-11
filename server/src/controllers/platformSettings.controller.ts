import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { MemberPermission } from '../models/platformSettings.model.js';
import type { IPlatformSettingsService } from '../services/platformSettings.service.js';
import type { IActivityService } from '../services/activity.service.js';
import { HttpError } from '../utils/httpError.js';

@injectable()
export class PlatformSettingsController {
  constructor(
    @inject(TOKENS.PlatformSettingsService)
    private readonly service: IPlatformSettingsService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  getAccess = async (_req: Request, res: Response) => {
    const actor = res.locals.authUser;
    if (!actor) throw new HttpError(401, 'Authentication required');
    res.status(200).json({
      data: {
        role: actor.role,
        permissions: await this.service.getEffectivePermissions(actor.role),
      },
    });
  };

  getSettings = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getSettings() });
  };

  updateSettings = async (req: Request, res: Response) => {
    const actor = res.locals.authUser;
    if (!actor) throw new HttpError(401, 'Authentication required');
    if (!Array.isArray(req.body.memberPermissions)) {
      throw new HttpError(400, 'memberPermissions must be an array');
    }
    const memberPermissions = Object.fromEntries(
      req.body.memberPermissions.map(
        (entry: { permission?: unknown; enabled?: unknown }) => {
          if (typeof entry?.permission !== 'string' || typeof entry.enabled !== 'boolean') {
            throw new HttpError(400, 'Each permission requires a permission key and enabled value');
          }
          return [entry.permission, entry.enabled];
        },
      ),
    ) as Partial<Record<MemberPermission, boolean>>;
    const before = await this.service.getSettings();
    const settings = await this.service.updateMemberPermissions(
      memberPermissions,
      actor.userId,
    );
    await this.activity.logEntityActivity({
      actor,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'System',
      entityTitle: 'Platform Settings',
      message: `${actor.name || actor.email} updated Member permissions.`,
      changes: this.activity.buildChangeSet(
        before.memberPermissions,
        settings.memberPermissions,
        Object.keys(settings.memberPermissions),
      ),
      req,
      visibility: 'admin_only',
    });
    res.status(200).json({ data: settings });
  };
}
