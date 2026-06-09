import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { mapOperationToDto } from '../dto/operation.dto.js';
import type { IActivityService } from '../services/activity.service.js';
import type { IOperationService } from '../services/operation.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const actor = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};
type OperationDto = ReturnType<typeof mapOperationToDto>;
const operationItem = (operation: OperationDto, itemId: string) =>
  operation.items.find((item) => item.id === itemId);

@injectable()
export class OperationController {
  constructor(
    @inject(TOKENS.OperationService)
    private readonly service: IOperationService,
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
    const before = await this.service.getById(req.params.id) as OperationDto;
    const data = await this.service.update(req.params.id, req.body, {
      userId: user.userId,
      role: user.role,
    }) as OperationDto;
    await this.activity.logEntityActivity({
      actor: user, action: ACTIVITY_ACTIONS.OPERATION_UPDATED, entityType: 'Operation',
      entityId: data.id, entityCode: data.operationCode, entityTitle: data.campaignTitle ?? undefined,
      message: `${data.operationCode} was updated.`,
      changes: this.activity.buildChangeSet(before, data, ['operationOwner.id', 'priority', 'status', 'importantDates', 'notes']),
      req,
    });
    res.status(200).json({
      data,
    });
  };
  status = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const before = await this.service.getById(req.params.id) as OperationDto;
    const data = await this.service.updateStatus(req.params.id, req.body.status, {
      userId: user.userId,
      role: user.role,
    }) as OperationDto;
    await this.activity.logEntityActivity({
      actor: user, action: ACTIVITY_ACTIONS.OPERATION_STATUS_CHANGED, entityType: 'Operation',
      entityId: data.id, entityCode: data.operationCode, entityTitle: data.campaignTitle ?? undefined,
      message: `${data.operationCode} status changed from ${before.status} to ${data.status}.`,
      changes: [{ field: 'status', from: before.status, to: data.status }],
      metadata: { statusFrom: before.status, statusTo: data.status }, req,
    });
    res.status(200).json({
      data,
    });
  };
  item = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.service.updateItem(
      req.params.id, req.params.itemId, req.body, user.userId,
    ) as OperationDto;
    await this.logItem(req, user, data, ACTIVITY_ACTIONS.OPERATION_ITEM_UPDATED, 'updated');
    res.status(200).json({
      data,
    });
  };
  creative = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.service.updateCreative(
      req.params.id, req.params.itemId, req.body, user.userId,
    ) as OperationDto;
    await this.logItem(req, user, data, ACTIVITY_ACTIONS.CREATIVE_UPDATED, 'creative was updated for');
    res.status(200).json({
      data,
    });
  };
  purchaseOrder = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.service.updatePurchaseOrder(
      req.params.id, req.params.itemId, req.body, user.userId,
    ) as OperationDto;
    await this.logItem(req, user, data, ACTIVITY_ACTIONS.PO_UPDATED, 'purchase order was updated for');
    res.status(200).json({
      data,
    });
  };
  mounting = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.service.updateMounting(
      req.params.id, req.params.itemId, req.body, user.userId,
    ) as OperationDto;
    await this.logItem(req, user, data, ACTIVITY_ACTIONS.MOUNTING_UPDATED, 'mounting was updated for');
    res.status(200).json({
      data,
    });
  };
  proof = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.service.updateProof(
      req.params.id, req.params.itemId, req.body, user.userId,
    ) as OperationDto;
    await this.logItem(req, user, data, ACTIVITY_ACTIONS.PROOF_UPDATED, 'proof was updated for');
    res.status(200).json({
      data,
    });
  };
  takedown = async (req: Request, res: Response) => {
    const user = actor(res.locals);
    const data = await this.service.updateTakedown(
      req.params.id, req.params.itemId, req.body, user.userId,
    ) as OperationDto;
    await this.logItem(req, user, data, ACTIVITY_ACTIONS.TAKEDOWN_UPDATED, 'takedown was updated for');
    res.status(200).json({
      data,
    });
  };

  private logItem = async (
    req: Request,
    user: AuthTokenPayload,
    operation: OperationDto,
    action: string,
    verb: string,
  ) => {
    const item = operationItem(operation, req.params.itemId);
    await this.activity.logEntityActivity({
      actor: user, action, entityType: 'OperationItem',
      entityId: item?.id, entityCode: item?.inventoryCode, entityTitle: item?.title,
      parentEntityType: 'Operation', parentEntityId: operation.id,
      parentEntityCode: operation.operationCode,
      message: verb === 'updated'
        ? `${item?.inventoryCode || 'Operation item'} was updated.`
        : `${operation.operationCode} ${verb} ${item?.inventoryCode || 'an item'}.`,
      req,
    });
  };
}
