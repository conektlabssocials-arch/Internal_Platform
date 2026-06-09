import { inject, injectable } from 'tsyringe';
import type { Request } from 'express';

import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import { TOKENS } from '../config/tokens.js';
import type { CampaignStatus } from '../models/campaign.model.js';
import type { IActivityService } from './activity.service.js';
import type { ICampaignService } from './campaign.service.js';
import type { CampaignCommandActor } from './campaignCommand.service.js';
import type { IPlanService } from './plan.service.js';
import type { PlanMutationDto } from '../dto/plan.dto.js';
import { HttpError } from '../utils/httpError.js';

type PlanDto = {
  id: string;
  campaign?: { id?: string; campaignCode?: string };
  versionLabel: string;
  title: string;
  status: string;
  isLocked: boolean;
  items: unknown[];
  pricing: Record<string, unknown>;
  clientNotes?: string;
  internalNotes?: string;
  updatedAt?: Date | string;
};

type CampaignState = {
  id: string;
  campaignCode: string;
  status: CampaignStatus;
  updatedAt?: Date | string;
};

export type CreatePlanCommandInput = PlanMutationDto & {
  expectedCampaignStatus?: CampaignStatus;
  expectedCampaignUpdatedAt?: string;
};

export type UpdatePlanCommandInput = PlanMutationDto & {
  expectedUpdatedAt?: string;
};

export interface IPlanAuthoringCommandService {
  create(
    campaignId: string,
    input: CreatePlanCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<PlanDto>;
  update(
    planId: string,
    input: UpdatePlanCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<PlanDto>;
  clone(
    planId: string,
    expectedUpdatedAt: string | undefined,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<PlanDto>;
}

const timestamp = (value?: Date | string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

@injectable()
export class PlanAuthoringCommandService
  implements IPlanAuthoringCommandService
{
  constructor(
    @inject(TOKENS.PlanService)
    private readonly plans: IPlanService,
    @inject(TOKENS.CampaignService)
    private readonly campaigns: ICampaignService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  async create(
    campaignId: string,
    input: CreatePlanCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const campaign = (await this.campaigns.getCampaignById(
      campaignId,
    )) as CampaignState;
    if (
      input.expectedCampaignStatus &&
      campaign.status !== input.expectedCampaignStatus
    ) {
      throw new HttpError(
        409,
        `Campaign status is ${campaign.status}, not ${input.expectedCampaignStatus}. Read the campaign again before creating a plan.`,
      );
    }
    this.assertFresh(
      campaign.updatedAt,
      input.expectedCampaignUpdatedAt,
      'Campaign',
    );

    const {
      expectedCampaignStatus: _expectedStatus,
      expectedCampaignUpdatedAt: _expectedUpdatedAt,
      ...mutation
    } = input;
    const data = (await this.plans.create(campaignId, {
      ...mutation,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    })) as PlanDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.PLAN_CREATED,
      entityType: 'Plan',
      entityId: data.id,
      entityCode: data.versionLabel,
      entityTitle: data.title,
      parentEntityType: 'Campaign',
      parentEntityId: data.campaign?.id || campaignId,
      parentEntityCode: data.campaign?.campaignCode || campaign.campaignCode,
      message: `Plan ${data.versionLabel} was created.`,
      metadata: { planVersionLabel: data.versionLabel },
      req,
    });

    return data;
  }

  async update(
    planId: string,
    input: UpdatePlanCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = (await this.plans.getById(planId)) as PlanDto;
    this.assertFresh(before.updatedAt, input.expectedUpdatedAt, 'Plan');

    const { expectedUpdatedAt: _expectedUpdatedAt, ...mutation } = input;
    const data = (await this.plans.update(planId, {
      ...mutation,
      updatedBy: actor.userId,
    })) as PlanDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.PLAN_UPDATED,
      entityType: 'Plan',
      entityId: data.id,
      entityCode: data.versionLabel,
      entityTitle: data.title,
      parentEntityType: 'Campaign',
      parentEntityId: data.campaign?.id,
      parentEntityCode: data.campaign?.campaignCode,
      message: `Plan ${data.versionLabel} was updated.`,
      changes: this.activity.buildChangeSet(
        { ...before, itemCount: before.items.length },
        { ...data, itemCount: data.items.length },
        [
          'pricing.grandTotal',
          'pricing.marginAmount',
          'itemCount',
          'clientNotes',
          'internalNotes',
        ],
      ),
      req,
    });

    const itemDifference = data.items.length - before.items.length;
    if (itemDifference !== 0) {
      await this.activity.logEntityActivity({
        actor,
        action:
          itemDifference > 0
            ? ACTIVITY_ACTIONS.PLAN_ITEM_ADDED
            : ACTIVITY_ACTIONS.PLAN_ITEM_REMOVED,
        entityType: 'Plan',
        entityId: data.id,
        entityCode: data.versionLabel,
        entityTitle: data.title,
        parentEntityType: 'Campaign',
        parentEntityId: data.campaign?.id,
        parentEntityCode: data.campaign?.campaignCode,
        message: `${Math.abs(itemDifference)} ${Math.abs(itemDifference) === 1 ? 'item was' : 'items were'} ${itemDifference > 0 ? 'added to' : 'removed from'} Plan ${data.versionLabel}.`,
        metadata: {
          itemCountBefore: before.items.length,
          itemCountAfter: data.items.length,
        },
        req,
      });
    }

    return data;
  }

  async clone(
    planId: string,
    expectedUpdatedAt: string | undefined,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = (await this.plans.getById(planId)) as PlanDto;
    this.assertFresh(before.updatedAt, expectedUpdatedAt, 'Plan');
    const data = (await this.plans.clone(planId, actor.userId)) as PlanDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.PLAN_CLONED,
      entityType: 'Plan',
      entityId: data.id,
      entityCode: data.versionLabel,
      entityTitle: data.title,
      parentEntityType: 'Campaign',
      parentEntityId: data.campaign?.id,
      parentEntityCode: data.campaign?.campaignCode,
      message: `Plan was cloned to ${data.versionLabel}.`,
      metadata: {
        clonedFromPlanId: before.id,
        planVersionLabel: data.versionLabel,
      },
      req,
    });

    return data;
  }

  private assertFresh(
    actual: Date | string | undefined,
    expected: string | undefined,
    entity: string,
  ) {
    if (expected && timestamp(actual) !== timestamp(expected)) {
      throw new HttpError(
        409,
        `${entity} changed since it was read. Read it again before continuing.`,
      );
    }
  }
}
