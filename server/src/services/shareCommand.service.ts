import { inject, injectable } from 'tsyringe';
import type { Request } from 'express';

import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import { TOKENS } from '../config/tokens.js';
import type { IActivityService } from './activity.service.js';
import type { CampaignCommandActor } from './campaignCommand.service.js';
import type { IPlanService } from './plan.service.js';
import type { CreateShareInput, IShareService } from './share.service.js';
import { HttpError } from '../utils/httpError.js';

type PlanState = {
  id: string;
  versionLabel: string;
  status: string;
  isLocked: boolean;
  updatedAt?: Date | string;
};

type ShareDto = {
  id: string;
  plan: string;
  status: string;
  channel?: string;
  shareUrl?: string;
  metadata?: {
    campaignCode?: string;
    planVersionLabel?: string;
  };
};

export type CreateShareCommandInput = CreateShareInput & {
  expectedPlanUpdatedAt?: string;
  expectedPlanStatus?: string;
};

export interface IShareCommandService {
  create(
    planId: string,
    input: CreateShareCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<ShareDto>;
  disable(
    shareId: string,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<ShareDto>;
}

const timestamp = (value?: Date | string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

@injectable()
export class ShareCommandService implements IShareCommandService {
  constructor(
    @inject(TOKENS.ShareService)
    private readonly shares: IShareService,
    @inject(TOKENS.PlanService)
    private readonly plans: IPlanService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  async create(
    planId: string,
    input: CreateShareCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const plan = (await this.plans.getById(planId)) as PlanState;
    if (
      input.expectedPlanStatus &&
      plan.status !== input.expectedPlanStatus
    ) {
      throw new HttpError(
        409,
        `Plan status is ${plan.status}, not ${input.expectedPlanStatus}. Read the plan again before sharing.`,
      );
    }
    if (
      input.expectedPlanUpdatedAt &&
      timestamp(plan.updatedAt) !== timestamp(input.expectedPlanUpdatedAt)
    ) {
      throw new HttpError(
        409,
        'Plan changed since it was read. Read it again before sharing.',
      );
    }

    const {
      expectedPlanStatus: _expectedStatus,
      expectedPlanUpdatedAt: _expectedUpdatedAt,
      ...shareInput
    } = input;
    const share = (await this.shares.create(
      planId,
      shareInput,
      actor.userId,
    )) as ShareDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.SHARE_CREATED,
      entityType: 'Share',
      entityId: share.id,
      entityTitle: share.metadata?.campaignCode,
      parentEntityType: 'Plan',
      parentEntityId: share.plan,
      parentEntityCode: share.metadata?.planVersionLabel,
      message: `A share link was created for ${share.metadata?.campaignCode || 'a plan'}.`,
      metadata: {
        shareChannel: share.channel,
        planVersionLabel: share.metadata?.planVersionLabel,
      },
      req,
    });

    return share;
  }

  async disable(
    shareId: string,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const existing = (await this.shares.getById(shareId)) as ShareDto;
    if (existing.status !== 'active') {
      throw new HttpError(409, `Share link is already ${existing.status}`);
    }

    const data = (await this.shares.disable(shareId)) as ShareDto;
    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.SHARE_DISABLED,
      entityType: 'Share',
      entityId: data.id,
      entityTitle: data.metadata?.campaignCode,
      parentEntityType: 'Plan',
      parentEntityId: data.plan,
      message: `A share link for ${data.metadata?.campaignCode || 'a plan'} was disabled.`,
      req,
    });
    return data;
  }
}
