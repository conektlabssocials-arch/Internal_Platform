import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { CampaignDto, CampaignFiltersDto } from '../dto/campaign.dto.js';
import type { ICampaignService } from '../services/campaign.service.js';
import type { IActivityService } from '../services/activity.service.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const authUser = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

@injectable()
export class CampaignController {
  constructor(
    @inject(TOKENS.CampaignService) private readonly service: ICampaignService,
    @inject(TOKENS.ActivityService) private readonly activity: IActivityService,
  ) {}

  list = async (req: Request, res: Response) => {
    res.status(200).json(await this.service.listCampaigns(req.query as CampaignFiltersDto));
  };
  summary = async (_req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getSummary() });
  };
  preview = async (_req: Request, res: Response) => {
    res.status(200).json({ previewCode: await this.service.previewCode() });
  };
  detail = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getCampaignById(req.params.id) });
  };
  create = async (req: Request, res: Response) => {
    const user = authUser(res.locals);
    const data = await this.service.createCampaign({
      ...req.body,
      ownerUser: req.body.ownerUser || user.userId,
      createdBy: user.userId,
      updatedBy: user.userId,
    }) as CampaignDto;
    await this.activity.logEntityActivity({
      actor: user, action: ACTIVITY_ACTIONS.CAMPAIGN_CREATED, entityType: 'Campaign',
      entityId: data.id, entityCode: data.campaignCode, entityTitle: data.title,
      message: `${data.campaignCode} campaign was created.`, req,
    });
    res.status(201).json({ data });
  };
  update = async (req: Request, res: Response) => {
    const user = authUser(res.locals);
    const before = await this.service.getCampaignById(req.params.id) as CampaignDto;
    const data = await this.service.updateCampaign(req.params.id, {
      ...req.body,
      campaignCode: undefined,
      updatedBy: user.userId,
    }) as CampaignDto;
    const changes = this.activity.buildChangeSet(before, data, ['status', 'budget', 'expectedRevenue', 'priority', 'nextFollowUpAt', 'ownerUser.id', 'categoriesOfInterest']);
    await this.activity.logEntityActivity({
      actor: user,
      action: changes.some((change) => change.field === 'nextFollowUpAt') ? ACTIVITY_ACTIONS.CAMPAIGN_FOLLOWUP_UPDATED : ACTIVITY_ACTIONS.CAMPAIGN_UPDATED,
      entityType: 'Campaign', entityId: data.id, entityCode: data.campaignCode, entityTitle: data.title,
      message: `${data.campaignCode} campaign was updated.`, changes, req,
    });
    res.status(200).json({ data });
  };
  status = async (req: Request, res: Response) => {
    const user = authUser(res.locals);
    const before = await this.service.getCampaignById(req.params.id) as CampaignDto;
    const data = await this.service.updateStatus(req.params.id, {
      status: req.body.status,
      reason: req.body.reason,
      updatedBy: user.userId,
    }) as CampaignDto;
    await this.activity.logEntityActivity({
      actor: user, action: ACTIVITY_ACTIONS.CAMPAIGN_STATUS_CHANGED, entityType: 'Campaign',
      entityId: data.id, entityCode: data.campaignCode, entityTitle: data.title,
      message: `${data.campaignCode} status changed from ${before.status} to ${data.status}.`,
      changes: [{ field: 'status', from: before.status, to: data.status }],
      metadata: { statusFrom: before.status, statusTo: data.status }, req,
    });
    res.status(200).json({ data });
  };
}
