import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const campaignClientTypes = ['Brand', 'Agency', 'Individual'] as const;
export const campaignSources = [
  'Call',
  'WhatsApp',
  'Email',
  'Referral',
  'Walk-in',
  'Website',
  'Other',
] as const;
export const campaignBudgetTypes = ['fixed', 'range', 'unknown'] as const;
export const campaignStatuses = [
  'New',
  'In Discussion',
  'Plan Shared',
  'Negotiating',
  'Won',
  'Lost',
  'On Hold',
] as const;
export const campaignPriorities = ['Low', 'Medium', 'High'] as const;
export const campaignCategories = ['Outdoor', 'Auto', 'Bus', 'Mobile Van'] as const;

const budgetSchema = new Schema(
  {
    min: Number,
    max: Number,
    fixed: Number,
  },
  { _id: false },
);

const campaignSchema = new Schema(
  {
    campaignCode: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    client: { type: Schema.Types.ObjectId, ref: 'CrmEntity', required: true },
    clientType: { type: String, enum: campaignClientTypes, required: true },
    agencyBrandName: { type: String, trim: true },
    source: { type: String, enum: campaignSources, required: true },
    brief: { type: String, required: true, trim: true },
    objective: { type: String, trim: true },
    budgetType: { type: String, enum: campaignBudgetTypes, default: 'unknown' },
    budget: budgetSchema,
    startDate: Date,
    endDate: Date,
    geos: { type: [String], default: [] },
    targetAudience: { type: String, trim: true },
    categoriesOfInterest: { type: [String], enum: campaignCategories, default: [] },
    ownerUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: campaignStatuses, default: 'New' },
    lostReason: { type: String, trim: true },
    onHoldReason: { type: String, trim: true },
    expectedRevenue: Number,
    priority: { type: String, enum: campaignPriorities, default: 'Medium' },
    nextFollowUpAt: Date,
    notes: { type: String, trim: true },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ client: 1, clientType: 1 });
campaignSchema.index({ ownerUser: 1, nextFollowUpAt: 1 });

export type CampaignClientType = (typeof campaignClientTypes)[number];
export type CampaignSource = (typeof campaignSources)[number];
export type CampaignBudgetType = (typeof campaignBudgetTypes)[number];
export type CampaignStatus = (typeof campaignStatuses)[number];
export type CampaignPriority = (typeof campaignPriorities)[number];
export type CampaignCategory = (typeof campaignCategories)[number];
export type CampaignSchema = InferSchemaType<typeof campaignSchema>;
export type CampaignDocument = HydratedDocument<CampaignSchema>;

export const CampaignModel = mongoose.model<CampaignSchema>('Campaign', campaignSchema);
