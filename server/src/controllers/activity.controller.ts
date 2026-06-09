import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';
import { TOKENS } from '../config/tokens.js';
import type { IActivityService } from '../services/activity.service.js';

@injectable()
export class ActivityController {
  constructor(@inject(TOKENS.ActivityService) private readonly service: IActivityService) {}
  list = async (req: Request, res: Response) => {
    res.status(200).json(await this.service.getActivities(req.query as any));
  };
  entity = async (req: Request, res: Response) => {
    res.status(200).json(
      await this.service.getEntityActivities(
        req.params.entityType,
        req.params.entityId,
        req.query.page?.toString(),
        req.query.limit?.toString(),
      ),
    );
  };
  audit = async (req: Request, res: Response) => {
    res.status(200).json(await this.service.getActivities(req.query as any, true));
  };
}
