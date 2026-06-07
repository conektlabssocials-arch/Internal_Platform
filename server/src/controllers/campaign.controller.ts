import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { CampaignFiltersDto } from '../dto/campaign.dto.js';
import type { ICampaignService } from '../services/campaign.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const authUser = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

@injectable()
export class CampaignController {
  constructor(
    @inject(TOKENS.CampaignService) private readonly service: ICampaignService,
  ) {}

  list = async (req: Request, res: Response) => {
    res.status(200).json(await this.service.listCampaigns(req.query as CampaignFiltersDto));
  };
  summary = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getSummary() });
  };
  preview = async (_req: Request, res: Response) => {
    res.status(200).json({ previewCode: await this.service.previewCode() });
  };
  detail = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getCampaignById(req.params.id) });
  };
  create = async (req: Request, res: Response) => {
    const user = authUser(res.locals);
    const data = await this.service.createCampaign({
      ...req.body,
      ownerUser: req.body.ownerUser || user.userId,
      createdBy: user.userId,
      updatedBy: user.userId,
    });
    res.status(201).json({ data });
  };
  update = async (req: Request, res: Response) => {
    const user = authUser(res.locals);
    const data = await this.service.updateCampaign(req.params.id, {
      ...req.body,
      campaignCode: undefined,
      updatedBy: user.userId,
    });
    res.status(200).json({ data });
  };
  status = async (req: Request, res: Response) => {
    const user = authUser(res.locals);
    const data = await this.service.updateStatus(req.params.id, {
      status: req.body.status,
      reason: req.body.reason,
      updatedBy: user.userId,
    });
    res.status(200).json({ data });
  };
}
