import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const shareStatuses = ['active', 'disabled', 'expired'] as const;
export const shareChannels = ['WhatsApp', 'Email', 'Phone', 'Other'] as const;

const shareMetadataSchema = new Schema(
  {
    planVersionLabel: String,
    campaignCode: String,
    clientName: String,
  },
  { _id: false },
);

const clickedPinSchema = new Schema(
  {
    inventoryCode: String,
    title: String,
    clickedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const mapTrackingSchema = new Schema(
  {
    mapOpenedCount: { type: Number, default: 0 },
    pinClickCount: { type: Number, default: 0 },
    clickedPins: { type: [clickedPinSchema], default: [] },
    lastMapInteractionAt: Date,
  },
  { _id: false },
);

const shareSchema = new Schema(
  {
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    token: { type: String, unique: true, required: true, index: true },
    status: { type: String, enum: shareStatuses, default: 'active' },
    expiresAt: Date,
    passwordHash: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastViewedAt: Date,
    viewCount: { type: Number, default: 0 },
    sharedWithName: { type: String, trim: true },
    sharedWithEmail: { type: String, trim: true, lowercase: true },
    sharedWithPhone: { type: String, trim: true },
    channel: { type: String, enum: shareChannels, default: 'Other' },
    metadata: { type: shareMetadataSchema, default: () => ({}) },
    mapTracking: { type: mapTrackingSchema, default: () => ({}) },
  },
  { timestamps: true },
);

shareSchema.index({ plan: 1, createdAt: -1 });

export type ShareStatus = (typeof shareStatuses)[number];
export type ShareChannel = (typeof shareChannels)[number];
export type ShareSchema = InferSchemaType<typeof shareSchema>;
export type ShareDocument = HydratedDocument<ShareSchema>;

export const ShareModel = mongoose.model<ShareSchema>('Share', shareSchema);
