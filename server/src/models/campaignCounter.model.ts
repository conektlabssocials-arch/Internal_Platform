import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

const campaignCounterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    year: { type: Number, required: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type CampaignCounterSchema = InferSchemaType<typeof campaignCounterSchema>;
export type CampaignCounterDocument = HydratedDocument<CampaignCounterSchema>;

export const CampaignCounterModel = mongoose.model<CampaignCounterSchema>(
  'CampaignCounter',
  campaignCounterSchema,
);
