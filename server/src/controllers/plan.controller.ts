import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { mapPlanToDto } from '../dto/plan.dto.js';
import type { IPlanService } from '../services/plan.service.js';
import type { IPlanCommandService } from '../services/planCommand.service.js';
import type { IPlanAuthoringCommandService } from '../services/planAuthoringCommand.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const user = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

type PlanDto = ReturnType<typeof mapPlanToDto>;

@injectable()
export class PlanController {
  constructor(
    @inject(TOKENS.PlanService) private readonly service: IPlanService,
    @inject(TOKENS.PlanCommandService)
    private readonly commands: IPlanCommandService,
    @inject(TOKENS.PlanAuthoringCommandService)
    private readonly authoring: IPlanAuthoringCommandService,
  ) {}

  listByCampaign = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.listByCampaign(req.params.campaignId) });
  };
  listRecent = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.listRecent() });
  };
  create = async (req: Request, res: Response) => {
    const actor = user(res.locals);
    const data = await this.authoring.create(
      req.params.campaignId,
      req.body,
      actor,
      req,
    );
    res.status(201).json({ data });
  };
  clone = async (req: Request, res: Response) => {
    const actor = user(res.locals);
    const data = await this.authoring.clone(
      req.params.id,
      undefined,
      actor,
      req,
    );
    res.status(201).json({ data });
  };
  detail = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getById(req.params.id) });
  };
  mapData = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getMapData(req.params.id) });
  };
  update = async (req: Request, res: Response) => {
    const data = await this.authoring.update(
      req.params.id,
      req.body,
      user(res.locals),
      req,
    );
    res.status(200).json({ data });
  };
  status = async (req: Request, res: Response) => {
    const actor = user(res.locals);
    const data = await this.commands.changeStatus(req.params.id, {
      status: req.body.status,
    }, actor, req);
    res.status(200).json({ data });
  };
  delete = async (req: Request, res: Response) => {
    await this.service.delete(req.params.id);
    res.status(200).json({ message: 'Plan deleted' });
  };
}
