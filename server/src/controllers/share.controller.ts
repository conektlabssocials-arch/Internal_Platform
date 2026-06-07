import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IShareService } from '../services/share.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const authUser = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

@injectable()
export class ShareController {
  constructor(@inject(TOKENS.ShareService) private readonly service: IShareService) {}

  create = async (req: Request, res: Response) => {
    const share = await this.service.create(
      req.params.planId,
      req.body,
      authUser(res.locals).userId,
    );
    res.status(201).json({ share, shareUrl: (share as { shareUrl: string }).shareUrl });
  };

  listByPlan = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.listByPlan(req.params.planId) });
  };

  disable = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.disable(req.params.shareId) });
  };

  publicDetail = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getPublic(req.params.token) });
  };

  trackPublic = async (req: Request, res: Response) => {
    await this.service.trackPublic(req.params.token, req.body);
    res.status(200).json({ success: true });
  };
}
