import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import { shareChannels } from '../models/share.model.js';
import type { ShareChannel, ShareDocument } from '../models/share.model.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import type { IShareRepository } from '../repositories/share.repository.js';
import type { IPlanService } from './plan.service.js';
import { HttpError } from '../utils/httpError.js';
import { createShareToken } from '../utils/shareToken.js';
import { buildPlanMapData } from '../utils/planMapData.js';

export type CreateShareInput = {
  expiresAt?: string;
  sharedWithName?: string;
  sharedWithEmail?: string;
  sharedWithPhone?: string;
  channel?: string;
};

export interface IShareService {
  create(planId: string, input: CreateShareInput, actorId: string): Promise<unknown>;
  listByPlan(planId: string): Promise<unknown[]>;
  getById(id: string): Promise<unknown>;
  disable(id: string): Promise<unknown>;
  getPublic(token: string): Promise<unknown>;
  trackPublic(token: string, input: TrackShareInput): Promise<void>;
}

export type TrackShareInput = {
  eventType?: string;
  inventoryCode?: string;
  title?: string;
};

const clean = (value?: string) => value?.trim() || undefined;
const trackingLabel = (value?: string) => clean(value)?.slice(0, 160);
const populatedRef = (value: any) =>
  value && typeof value === 'object' && value._id
    ? { id: value._id.toString(), name: value.name || '', email: value.email }
    : undefined;

const mapShare = (share: ShareDocument) => ({
  id: share._id.toString(),
  plan: share.plan.toString(),
  campaign: share.campaign.toString(),
  status: share.status,
  expiresAt: share.expiresAt,
  createdBy: populatedRef(share.createdBy),
  createdAt: share.createdAt,
  lastViewedAt: share.lastViewedAt,
  viewCount: share.viewCount,
  sharedWithName: share.sharedWithName,
  sharedWithEmail: share.sharedWithEmail,
  sharedWithPhone: share.sharedWithPhone,
  channel: share.channel,
  metadata: share.metadata,
  mapOpenedCount: share.mapTracking?.mapOpenedCount || 0,
  pinClickCount: share.mapTracking?.pinClickCount || 0,
  lastMapInteractionAt: share.mapTracking?.lastMapInteractionAt,
  shareUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/share/plan/${share.token}`,
});

const parseExpiry = (value?: string) => {
  if (!value) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T23:59:59.999` : value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'expiresAt is invalid');
  if (date <= new Date()) throw new HttpError(400, 'expiresAt must be in the future');
  return date;
};

const clientName = (campaign: any) =>
  campaign.client?.displayName || campaign.client?.name || 'Client';

const mapPublicPlan = (share: any) => {
  const plan = share.plan;
  const campaign = plan.campaign;
  const mapData = buildPlanMapData(plan.items || []);
  return {
    share: {
      status: share.status,
      expiresAt: share.expiresAt,
      viewCount: (share.viewCount || 0) + 1,
    },
    campaign: {
      title: campaign.title,
      clientName: clientName(campaign),
      brief: campaign.brief,
    },
    plan: {
      versionLabel: plan.versionLabel,
      status: plan.status,
      clientNotes: plan.clientNotes,
      items: (plan.items || []).map((item: any) => ({
        title: item.title,
        categoryGroup: item.categoryGroup,
        subCategory: item.subCategory,
        city: item.city,
        area: item.area,
        width: item.width,
        height: item.height,
        totalSqFt: item.totalSqFt,
        startDate: item.startDate,
        endDate: item.endDate,
        quantity: item.quantity,
        unitSellingPrice: item.unitSellingPrice,
        totalSellingPrice: item.totalSellingPrice,
        notes: item.notes,
        photoUrl: item.photos?.[0],
      })),
      pricing: {
        subtotal: plan.pricing?.subtotal || 0,
        taxPercentage: plan.pricing?.taxPercentage || 0,
        taxAmount: plan.pricing?.taxAmount || 0,
        grandTotal: plan.pricing?.grandTotal || 0,
      },
    },
    ...mapData,
  };
};

@injectable()
export class ShareService implements IShareService {
  constructor(
    @inject(TOKENS.ShareRepository)
    private readonly shares: IShareRepository,
    @inject(TOKENS.PlanRepository)
    private readonly plans: IPlanRepository,
    @inject(TOKENS.PlanService)
    private readonly planService: IPlanService,
  ) {}

  async create(planId: string, input: CreateShareInput, actorId: string) {
    this.validateId(planId, 'planId');
    let plan = await this.plans.findByIdPopulated(planId);
    if (!plan) throw new HttpError(404, 'Plan not found');

    if (plan.status === 'Draft') {
      await this.planService.updateStatus(planId, { status: 'Shared', actorId });
      plan = await this.plans.findByIdPopulated(planId);
      if (!plan) throw new HttpError(404, 'Plan not found');
    } else if (!plan.isLocked) {
      throw new HttpError(400, 'Plan must be locked before it can be shared');
    }

    const channel = input.channel || 'Other';
    if (!shareChannels.includes(channel as ShareChannel)) {
      throw new HttpError(400, 'channel is invalid');
    }

    const campaign = plan.campaign as any;
    const share = await this.shares.create({
      plan: plan._id,
      campaign: campaign._id,
      token: createShareToken(),
      status: 'active',
      expiresAt: parseExpiry(input.expiresAt),
      createdBy: new Types.ObjectId(actorId),
      sharedWithName: clean(input.sharedWithName),
      sharedWithEmail: clean(input.sharedWithEmail),
      sharedWithPhone: clean(input.sharedWithPhone),
      channel,
      metadata: {
        planVersionLabel: plan.versionLabel,
        campaignCode: campaign.campaignCode,
        clientName: clientName(campaign),
      },
    });

    return mapShare(await this.requireShare(share._id.toString()));
  }

  async listByPlan(planId: string) {
    this.validateId(planId, 'planId');
    return (await this.shares.findByPlan(planId)).map(mapShare);
  }

  async getById(id: string) {
    return mapShare(await this.requireShare(id));
  }

  async disable(id: string) {
    const share = await this.requireShare(id);
    share.status = 'disabled';
    await this.shares.save(share);
    return mapShare(await this.requireShare(id));
  }

  async getPublic(token: string) {
    const share = await this.requireActivePublicShare(token);
    if (!share.plan || typeof share.plan !== 'object' || !(share.plan as any).campaign) {
      throw new HttpError(404, 'Shared plan not found');
    }

    const viewedAt = new Date();
    await this.shares.recordView(share._id.toString(), viewedAt);
    return mapPublicPlan(share);
  }

  async trackPublic(token: string, input: TrackShareInput) {
    const share = await this.requireActivePublicShare(token);
    const interactedAt = new Date();

    if (input.eventType === 'map_opened') {
      await this.shares.recordMapOpened(share._id.toString(), interactedAt);
      return;
    }
    if (input.eventType === 'pin_clicked') {
      await this.shares.recordPinClick(share._id.toString(), {
        inventoryCode: trackingLabel(input.inventoryCode),
        title: trackingLabel(input.title),
        clickedAt: interactedAt,
      });
      return;
    }
    throw new HttpError(400, 'eventType is invalid');
  }

  private async requireActivePublicShare(token: string) {
    if (!token || !/^[a-f0-9]{48}$/i.test(token)) {
      throw new HttpError(404, 'Share link not found');
    }
    const share = await this.shares.findByTokenPopulated(token);
    if (!share || share.status === 'disabled') {
      throw new HttpError(404, 'Share link not found');
    }
    if (share.status === 'expired' || (share.expiresAt && share.expiresAt <= new Date())) {
      if (share.status !== 'expired') {
        share.status = 'expired';
        await this.shares.save(share);
      }
      throw new HttpError(410, 'This share link has expired');
    }
    if (share.status !== 'active') throw new HttpError(404, 'Share link not found');
    return share;
  }

  private async requireShare(id: string) {
    this.validateId(id, 'shareId');
    const share = await this.shares.findByIdPopulated(id);
    if (!share) throw new HttpError(404, 'Share link not found');
    return share;
  }

  private validateId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, `${field} is invalid`);
  }
}
