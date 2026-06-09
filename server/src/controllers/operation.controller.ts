import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { mapOperationToDto } from '../dto/operation.dto.js';
import type { IActivityService } from '../services/activity.service.js';
import type { IOperationService } from '../services/operation.service.js';
import type { IOperationCommandService } from '../services/operationCommand.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const actor = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};
type OperationDto = ReturnType<typeof mapOperationToDto>;

@injectable()
export class OperationController {
  constructor(
    @inject(TOKENS.OperationService)
    private readonly service: IOperationService,
    @inject(TOKENS.OperationCommandService)
    private readonly commands: IOperationCommandService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
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
    const user = actor(res.locals);
    const data = await this.service.createOperationFromWonPlan(
      req.params.planId,
      user.userId,
    ) as OperationDto;
    await this.activity.logEntityActivity({
      actor: user, action: ACTIVITY_ACTIONS.OPERATION_CREATED, entityType: 'Operation',
      entityId: data.id, entityCode: data.operationCode, entityTitle: data.campaignTitle ?? undefined,
      parentEntityType: 'Plan', parentEntityId: data.plan,
      parentEntityCode: data.planVersionLabel ?? undefined,
      message: `${data.operationCode} was created from Plan ${data.planVersionLabel}.`, req,
    });
    res.status(200).json({
      data,
    });
  };
  update = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.commands.updateOperation(
      req.params.id,
      req.body,
      user,
      req,
    );
    res.status(200).json({
      data,
    });
  };
  status = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.commands.changeStatus(req.params.id, {
      status: req.body.status,
    }, user, req);
    res.status(200).json({
      data,
    });
  };
  item = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.commands.updateItem(
      req.params.id,
      req.params.itemId,
      'item',
      { mutation: req.body },
      user,
      req,
    );
    res.status(200).json({
      data,
    });
  };
  creative = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.commands.updateItem(
      req.params.id,
      req.params.itemId,
      'creative',
      { mutation: req.body },
      user,
      req,
    );
    res.status(200).json({
      data,
    });
  };
  purchaseOrder = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.commands.updateItem(
      req.params.id,
      req.params.itemId,
      'purchaseOrder',
      { mutation: req.body },
      user,
      req,
    );
    res.status(200).json({
      data,
    });
  };
  mounting = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.commands.updateItem(
      req.params.id,
      req.params.itemId,
      'mounting',
      { mutation: req.body },
      user,
      req,
    );
    res.status(200).json({
      data,
    });
  };
  proof = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.commands.updateItem(
      req.params.id,
      req.params.itemId,
      'proof',
      { mutation: req.body },
      user,
      req,
    );
    res.status(200).json({
      data,
    });
  };
  takedown = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.commands.updateItem(
      req.params.id,
      req.params.itemId,
      'takedown',
      { mutation: req.body },
      user,
      req,
    );
    res.status(200).json({
      data,
    });
  };
}
