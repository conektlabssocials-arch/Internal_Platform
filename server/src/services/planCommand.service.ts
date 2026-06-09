import { inject, injectable } from 'tsyringe';
import type { Request } from 'express';

import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import { TOKENS } from '../config/tokens.js';
import type { mapPlanToDto } from '../dto/plan.dto.js';
import type { PlanStatus } from '../models/plan.model.js';
import type { IActivityService } from './activity.service.js';
import type { CampaignCommandActor } from './campaignCommand.service.js';
import type { IOperationService } from './operation.service.js';
import type { IPlanService } from './plan.service.js';
import { HttpError } from '../utils/httpError.js';

type PlanDto = ReturnType<typeof mapPlanToDto>;

export type PlanStatusCommandInput = {
  status: PlanStatus;
  expectedCurrentStatus?: PlanStatus;
};

export interface IPlanCommandService {
  changeStatus(
    id: string,
    input: PlanStatusCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<PlanDto>;
}

@injectable()
export class PlanCommandService implements IPlanCommandService {
  constructor(
    @inject(TOKENS.PlanService)
    private readonly plans: IPlanService,
    @inject(TOKENS.OperationService)
    private readonly operations: IOperationService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  async changeStatus(
    id: string,
    input: PlanStatusCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = (await this.plans.getById(id)) as PlanDto;
    if (
      input.expectedCurrentStatus &&
      before.status !== input.expectedCurrentStatus
    ) {
      throw new HttpError(
        409,
        `Plan status is ${before.status}, not ${input.expectedCurrentStatus}. Read the plan again before updating.`,
      );
    }
    if (before.status === input.status) {
      throw new HttpError(409, `Plan is already ${input.status}`);
    }

    let operationExisted = false;
    if (input.status === 'Won') {
      try {
        await this.operations.getByPlan(id);
        operationExisted = true;
      } catch {
        operationExisted = false;
      }
    }

    const data = (await this.plans.updateStatus(id, {
      status: input.status,
      actorId: actor.userId,
    })) as PlanDto;
    const action =
      data.status === 'Shared'
        ? ACTIVITY_ACTIONS.PLAN_SHARED
        : data.status === 'Won'
          ? ACTIVITY_ACTIONS.PLAN_WON
          : data.status === 'Lost'
            ? ACTIVITY_ACTIONS.PLAN_LOST
            : ACTIVITY_ACTIONS.PLAN_STATUS_CHANGED;

    await this.activity.logEntityActivity({
      actor,
      action,
      entityType: 'Plan',
      entityId: data.id,
      entityCode: data.versionLabel,
      entityTitle: data.title,
      parentEntityType: 'Campaign',
      parentEntityId: data.campaign?.id,
      parentEntityCode: data.campaign?.campaignCode,
      message: `Plan ${data.versionLabel} status changed from ${before.status} to ${data.status}.`,
      changes: [{ field: 'status', from: before.status, to: data.status }],
      metadata: {
        statusFrom: before.status,
        statusTo: data.status,
        planVersionLabel: data.versionLabel,
      },
      req,
    });

    if (data.status === 'Won' && !operationExisted) {
      const operation = (await this.operations.getByPlan(data.id)) as {
        id: string;
        operationCode: string;
        campaignTitle?: string | null;
      };
      await this.activity.logEntityActivity({
        actor,
        action: ACTIVITY_ACTIONS.OPERATION_CREATED,
        entityType: 'Operation',
        entityId: operation.id,
        entityCode: operation.operationCode,
        entityTitle: operation.campaignTitle ?? data.title,
        parentEntityType: 'Plan',
        parentEntityId: data.id,
        parentEntityCode: data.versionLabel,
        message: `${operation.operationCode} was created from Plan ${data.versionLabel}.`,
        req,
      });
    }

    return data;
  }
}
