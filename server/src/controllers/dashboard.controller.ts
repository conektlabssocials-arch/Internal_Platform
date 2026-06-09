import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IDashboardService } from '../services/dashboard.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const user = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

@injectable()
export class DashboardController {
  constructor(
    @inject(TOKENS.DashboardService)
    private readonly service: IDashboardService,
  ) {}

  overview = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.overview(user(res.locals).userId) });
  };

  myWork = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.myWork(user(res.locals).userId) });
  };

  campaigns = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.campaigns() });
  };

  plans = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.plans() });
  };

  inventory = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.inventory() });
  };

  operations = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.operations() });
  };
}
