import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IOperationService } from '../services/operation.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const actor = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

@injectable()
export class OperationController {
  constructor(
    @inject(TOKENS.OperationService)
    private readonly service: IOperationService,
  ) {}

  list = async (req: Request, res: Response) => {
    res.status(200).json(await this.service.list(req.query));
  };
  summary = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.summary() });
  };
  detail = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getById(req.params.id) });
  };
  byPlan = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getByPlan(req.params.planId) });
  };
  syncFromPlan = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.createOperationFromWonPlan(
        req.params.planId,
        actor(res.locals).userId,
      ),
    });
  };
  update = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    res.status(200).json({
      data: await this.service.update(req.params.id, req.body, {
        userId: user.userId,
        role: user.role,
      }),
    });
  };
  status = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    res.status(200).json({
      data: await this.service.updateStatus(req.params.id, req.body.status, {
        userId: user.userId,
        role: user.role,
      }),
    });
  };
  item = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.updateItem(
        req.params.id,
        req.params.itemId,
        req.body,
        actor(res.locals).userId,
      ),
    });
  };
  creative = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.updateCreative(
        req.params.id,
        req.params.itemId,
        req.body,
        actor(res.locals).userId,
      ),
    });
  };
  purchaseOrder = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.updatePurchaseOrder(
        req.params.id,
        req.params.itemId,
        req.body,
        actor(res.locals).userId,
      ),
    });
  };
  mounting = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.updateMounting(
        req.params.id,
        req.params.itemId,
        req.body,
        actor(res.locals).userId,
      ),
    });
  };
  proof = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.updateProof(
        req.params.id,
        req.params.itemId,
        req.body,
        actor(res.locals).userId,
      ),
    });
  };
  takedown = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.updateTakedown(
        req.params.id,
        req.params.itemId,
        req.body,
        actor(res.locals).userId,
      ),
    });
  };
}
