import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IPlanService } from '../services/plan.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const user = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

@injectable()
export class PlanController {
  constructor(@inject(TOKENS.PlanService) private readonly service: IPlanService) {}

  listByCampaign = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.listByCampaign(req.params.campaignId) });
  };
  listRecent = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.listRecent() });
  };
  create = async (req: Request, res: Response) => {
    const actor = user(res.locals);
    const data = await this.service.create(req.params.campaignId, {
      ...req.body,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    res.status(201).json({ data });
  };
  clone = async (req: Request, res: Response) => {
    res.status(201).json({ data: await this.service.clone(req.params.id, user(res.locals).userId) });
  };
  detail = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getById(req.params.id) });
  };
  mapData = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getMapData(req.params.id) });
  };
  update = async (req: Request, res: Response) => {
    const data = await this.service.update(req.params.id, {
      ...req.body,
      updatedBy: user(res.locals).userId,
    });
    res.status(200).json({ data });
  };
  status = async (req: Request, res: Response) => {
    const data = await this.service.updateStatus(req.params.id, {
      status: req.body.status,
      actorId: user(res.locals).userId,
    });
    res.status(200).json({ data });
  };
  delete = async (req: Request, res: Response) => {
    await this.service.delete(req.params.id);
    res.status(200).json({ message: 'Plan deleted' });
  };
}
