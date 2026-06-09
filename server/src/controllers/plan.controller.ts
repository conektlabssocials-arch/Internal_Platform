import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { mapPlanToDto } from '../dto/plan.dto.js';
import type { IPlanService } from '../services/plan.service.js';
import type { IOperationService } from '../services/operation.service.js';
import type { IActivityService } from '../services/activity.service.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
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
    @inject(TOKENS.ActivityService) private readonly activity: IActivityService,
    @inject(TOKENS.OperationService) private readonly operations: IOperationService,
  ) {}

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
    }) as PlanDto;
    await this.activity.logEntityActivity({
      actor, action: ACTIVITY_ACTIONS.PLAN_CREATED, entityType: 'Plan',
      entityId: data.id, entityCode: data.versionLabel, entityTitle: data.title,
      parentEntityType: 'Campaign', parentEntityId: data.campaign?.id || req.params.campaignId,
      parentEntityCode: data.campaign?.campaignCode,
      message: `Plan ${data.versionLabel} was created.`, metadata: { planVersionLabel: data.versionLabel }, req,
    });
    res.status(201).json({ data });
  };
  clone = async (req: Request, res: Response) => {
    const actor = user(res.locals);
    const data = await this.service.clone(req.params.id, actor.userId) as PlanDto;
    await this.activity.logEntityActivity({
      actor, action: ACTIVITY_ACTIONS.PLAN_CLONED, entityType: 'Plan',
      entityId: data.id, entityCode: data.versionLabel, entityTitle: data.title,
      parentEntityType: 'Campaign', parentEntityId: data.campaign?.id,
      parentEntityCode: data.campaign?.campaignCode,
      message: `Plan was cloned to ${data.versionLabel}.`, metadata: { planVersionLabel: data.versionLabel }, req,
    });
    res.status(201).json({ data });
  };
  detail = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getById(req.params.id) });
  };
  mapData = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getMapData(req.params.id) });
  };
  update = async (req: Request, res: Response) => {
    const before = await this.service.getById(req.params.id) as PlanDto;
    const data = await this.service.update(req.params.id, {
      ...req.body,
      updatedBy: user(res.locals).userId,
    }) as PlanDto;
    await this.activity.logEntityActivity({
      actor: user(res.locals), action: ACTIVITY_ACTIONS.PLAN_UPDATED, entityType: 'Plan',
      entityId: data.id, entityCode: data.versionLabel, entityTitle: data.title,
      parentEntityType: 'Campaign', parentEntityId: data.campaign?.id,
      parentEntityCode: data.campaign?.campaignCode,
      message: `Plan ${data.versionLabel} was updated.`,
      changes: this.activity.buildChangeSet(
        { ...before, itemCount: before.items?.length },
        { ...data, itemCount: data.items?.length },
        ['status','pricing.grandTotal','pricing.marginAmount','itemCount','clientNotes','internalNotes'],
      ),
      req,
    });
    const itemDifference = data.items.length - before.items.length;
    if (itemDifference !== 0) {
      await this.activity.logEntityActivity({
        actor: user(res.locals),
        action: itemDifference > 0 ? ACTIVITY_ACTIONS.PLAN_ITEM_ADDED : ACTIVITY_ACTIONS.PLAN_ITEM_REMOVED,
        entityType: 'Plan', entityId: data.id, entityCode: data.versionLabel,
        entityTitle: data.title, parentEntityType: 'Campaign',
        parentEntityId: data.campaign?.id, parentEntityCode: data.campaign?.campaignCode,
        message: `${Math.abs(itemDifference)} ${Math.abs(itemDifference) === 1 ? 'item was' : 'items were'} ${itemDifference > 0 ? 'added to' : 'removed from'} Plan ${data.versionLabel}.`,
        metadata: { itemCountBefore: before.items.length, itemCountAfter: data.items.length },
        req,
      });
    }
    res.status(200).json({ data });
  };
  status = async (req: Request, res: Response) => {
    const before = await this.service.getById(req.params.id) as PlanDto;
    const actor = user(res.locals);
    let operationExisted = false;
    if (req.body.status === 'Won') {
      try {
        await this.operations.getByPlan(req.params.id);
        operationExisted = true;
      } catch {
        operationExisted = false;
      }
    }
    const data = await this.service.updateStatus(req.params.id, {
      status: req.body.status,
      actorId: actor.userId,
    }) as PlanDto;
    const action = data.status === 'Shared' ? ACTIVITY_ACTIONS.PLAN_SHARED : data.status === 'Won' ? ACTIVITY_ACTIONS.PLAN_WON : data.status === 'Lost' ? ACTIVITY_ACTIONS.PLAN_LOST : ACTIVITY_ACTIONS.PLAN_STATUS_CHANGED;
    await this.activity.logEntityActivity({
      actor, action, entityType: 'Plan', entityId: data.id, entityCode: data.versionLabel,
      entityTitle: data.title, parentEntityType: 'Campaign', parentEntityId: data.campaign?.id,
      parentEntityCode: data.campaign?.campaignCode,
      message: `Plan ${data.versionLabel} status changed from ${before.status} to ${data.status}.`,
      changes: [{ field: 'status', from: before.status, to: data.status }],
      metadata: { statusFrom: before.status, statusTo: data.status, planVersionLabel: data.versionLabel }, req,
    });
    if (data.status === 'Won' && !operationExisted) {
      const operation = await this.operations.getByPlan(data.id) as {
        id: string;
        operationCode: string;
        campaignTitle?: string | null;
      };
      await this.activity.logEntityActivity({
        actor, action: ACTIVITY_ACTIONS.OPERATION_CREATED, entityType: 'Operation',
        entityId: operation.id, entityCode: operation.operationCode,
        entityTitle: operation.campaignTitle ?? data.title,
        parentEntityType: 'Plan', parentEntityId: data.id,
        parentEntityCode: data.versionLabel,
        message: `${operation.operationCode} was created from Plan ${data.versionLabel}.`, req,
      });
    }
    res.status(200).json({ data });
  };
  delete = async (req: Request, res: Response) => {
    await this.service.delete(req.params.id);
    res.status(200).json({ message: 'Plan deleted' });
  };
}
