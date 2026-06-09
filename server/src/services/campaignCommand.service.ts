import { inject, injectable } from 'tsyringe';
import type { Request } from 'express';

import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import { TOKENS } from '../config/tokens.js';
import type {
  CampaignDto,
  CampaignMutationDto,
} from '../dto/campaign.dto.js';
import type { CampaignStatus } from '../models/campaign.model.js';
import type { IActivityService } from './activity.service.js';
import type { ICampaignService } from './campaign.service.js';
import { HttpError } from '../utils/httpError.js';

export type CampaignCommandActor = {
  userId: string;
  email: string;
  role: string;
  name?: string;
};

export type CampaignFollowUpInput = {
  nextFollowUpAt: string;
  expectedCurrentFollowUpAt: string | null;
  followUpNote?: string;
};

export type CampaignStatusInput = {
  status: CampaignStatus;
  expectedCurrentStatus?: CampaignStatus;
  reason?: string;
};

export interface ICampaignCommandService {
  updateCampaign(
    id: string,
    input: CampaignMutationDto,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<CampaignDto>;
  updateFollowUp(
    id: string,
    input: CampaignFollowUpInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<CampaignDto>;
  changeStatus(
    id: string,
    input: CampaignStatusInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<CampaignDto>;
}

const timestamp = (value?: Date | string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

@injectable()
export class CampaignCommandService implements ICampaignCommandService {
  constructor(
    @inject(TOKENS.CampaignService)
    private readonly campaigns: ICampaignService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  async updateCampaign(
    id: string,
    input: CampaignMutationDto,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = (await this.campaigns.getCampaignById(id)) as CampaignDto;
    const data = (await this.campaigns.updateCampaign(id, {
      ...input,
      createdBy: undefined,
      updatedBy: actor.userId,
    })) as CampaignDto;
    const changes = this.activity.buildChangeSet(before, data, [
      'status',
      'budget',
      'expectedRevenue',
      'priority',
      'nextFollowUpAt',
      'ownerUser.id',
      'categoriesOfInterest',
    ]);

    await this.activity.logEntityActivity({
      actor,
      action: changes.some((change) => change.field === 'nextFollowUpAt')
        ? ACTIVITY_ACTIONS.CAMPAIGN_FOLLOWUP_UPDATED
        : ACTIVITY_ACTIONS.CAMPAIGN_UPDATED,
      entityType: 'Campaign',
      entityId: data.id,
      entityCode: data.campaignCode,
      entityTitle: data.title,
      message: `${data.campaignCode} campaign was updated.`,
      changes,
      req,
    });

    return data;
  }

  async updateFollowUp(
    id: string,
    input: CampaignFollowUpInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = (await this.campaigns.getCampaignById(id)) as CampaignDto;
    if (
      timestamp(before.nextFollowUpAt) !==
      timestamp(input.expectedCurrentFollowUpAt)
    ) {
      throw new HttpError(
        409,
        'Campaign follow-up changed since it was read. Read the campaign again before updating.',
      );
    }

    const data = (await this.campaigns.updateCampaign(id, {
      nextFollowUpAt: new Date(input.nextFollowUpAt),
      updatedBy: actor.userId,
    })) as CampaignDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.CAMPAIGN_FOLLOWUP_UPDATED,
      entityType: 'Campaign',
      entityId: data.id,
      entityCode: data.campaignCode,
      entityTitle: data.title,
      message: `${data.campaignCode} follow-up was scheduled.`,
      changes: [
        {
          field: 'nextFollowUpAt',
          from: before.nextFollowUpAt,
          to: data.nextFollowUpAt,
        },
      ],
      metadata: input.followUpNote
        ? { followUpNote: input.followUpNote }
        : undefined,
      req,
    });

    return data;
  }

  async changeStatus(
    id: string,
    input: CampaignStatusInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = (await this.campaigns.getCampaignById(id)) as CampaignDto;
    if (
      input.expectedCurrentStatus &&
      before.status !== input.expectedCurrentStatus
    ) {
      throw new HttpError(
        409,
        `Campaign status is ${before.status}, not ${input.expectedCurrentStatus}. Read the campaign again before updating.`,
      );
    }
    if (before.status === input.status) {
      throw new HttpError(409, `Campaign is already ${input.status}`);
    }

    const data = (await this.campaigns.updateStatus(id, {
      status: input.status,
      reason: input.reason,
      updatedBy: actor.userId,
    })) as CampaignDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.CAMPAIGN_STATUS_CHANGED,
      entityType: 'Campaign',
      entityId: data.id,
      entityCode: data.campaignCode,
      entityTitle: data.title,
      message: `${data.campaignCode} status changed from ${before.status} to ${data.status}.`,
      changes: [{ field: 'status', from: before.status, to: data.status }],
      metadata: {
        statusFrom: before.status,
        statusTo: data.status,
        ...(input.reason ? { reason: input.reason } : {}),
      },
      req,
    });

    return data;
  }
}
