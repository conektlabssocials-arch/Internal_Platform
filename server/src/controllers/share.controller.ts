import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IShareService } from '../services/share.service.js';
import type { IShareCommandService } from '../services/shareCommand.service.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { IActivityService } from '../services/activity.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const authUser = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

@injectable()
export class ShareController {
  constructor(
    @inject(TOKENS.ShareService) private readonly service: IShareService,
    @inject(TOKENS.ShareCommandService)
    private readonly commands: IShareCommandService,
    @inject(TOKENS.ActivityService) private readonly activity: IActivityService,
  ) {}

  create = async (req: Request, res: Response) => {
    const actor = authUser(res.locals);
    const share = await this.commands.create(
      req.params.planId,
      req.body,
      actor,
      req,
    );
    res.status(201).json({ share, shareUrl: (share as { shareUrl: string }).shareUrl });
  };

  listByPlan = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.listByPlan(req.params.planId) });
  };

  disable = async (req: Request, res: Response) => {
    const data = await this.commands.disable(
      req.params.shareId,
      authUser(res.locals),
      req,
    );
    res.status(200).json({ data });
  };

  publicDetail = async (req: Request, res: Response) => {
    const data = await this.service.getPublic(req.params.token) as any;
    await this.activity.logEntityActivity({
      actor: null, actorName: 'Client viewer', action: ACTIVITY_ACTIONS.SHARE_VIEWED,
      entityType: 'Share', entityTitle: data.campaign?.title,
      message: `Client viewed shared plan for ${data.campaign?.title || 'a campaign'}.`, req,
    });
    res.status(200).json({ data });
  };

  trackPublic = async (req: Request, res: Response) => {
    await this.service.trackPublic(req.params.token, req.body);
    const pinClicked = req.body.eventType === 'pin_clicked';
    await this.activity.logEntityActivity({
      actor: null, actorName: 'Client viewer',
      action: pinClicked ? ACTIVITY_ACTIONS.SHARE_PIN_CLICKED : ACTIVITY_ACTIONS.SHARE_MAP_OPENED,
      entityType: 'Share',
      entityCode: pinClicked ? req.body.inventoryCode : undefined,
      entityTitle: pinClicked ? req.body.title : undefined,
      message: pinClicked
        ? `Client clicked map pin ${req.body.inventoryCode || req.body.title || 'on the shared plan'}.`
        : 'Client opened the shared plan map.',
      req,
    });
    res.status(200).json({ success: true });
  };
}
