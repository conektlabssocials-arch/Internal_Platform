import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const planStatuses = ['Draft', 'Shared', 'Negotiating', 'Won', 'Lost'] as const;

const planItemLocationSchema = new Schema(
  {
    address: String,
    latitude: Number,
    longitude: Number,
  },
  { _id: false },
);

const planItemSchema = new Schema(
  {
    inventory: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true },
    inventoryCode: { type: String, required: true },
    title: { type: String, required: true },
    categoryGroup: String,
    subCategory: String,
    city: String,
    area: String,
    width: Number,
    height: Number,
    totalSqFt: Number,
    location: planItemLocationSchema,
    photos: { type: [String], default: [] },
    route: String,
    depot: String,
    itinerary: String,
    screenSize: String,
    numberOfScreens: Number,
    households: Number,
    approxReach: Number,
    monthlyImpressions: Number,
    buildingAge: Number,
    startDate: Date,
    endDate: Date,
    durationDays: { type: Number, default: 1 },
    quantity: { type: Number, default: 1 },
    unitSellingPrice: { type: Number, default: 0 },
    totalSellingPrice: { type: Number, default: 0 },
    unitInternalCost: { type: Number, default: 0 },
    totalInternalCost: { type: Number, default: 0 },
    marginAmount: { type: Number, default: 0 },
    marginPercentage: { type: Number, default: 0 },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const pricingSchema = new Schema(
  {
    subtotal: { type: Number, default: 0 },
    taxPercentage: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    internalCostTotal: { type: Number, default: 0 },
    marginAmount: { type: Number, default: 0 },
    marginPercentage: { type: Number, default: 0 },
  },
  { _id: false },
);

const planSchema = new Schema(
  {
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    versionNumber: { type: Number, required: true },
    versionLabel: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: planStatuses, default: 'Draft' },
    isLocked: { type: Boolean, default: false },
    items: { type: [planItemSchema], default: [] },
    pricing: { type: pricingSchema, default: () => ({}) },
    clientNotes: { type: String, trim: true },
    internalNotes: { type: String, trim: true },
    clonedFromPlan: { type: Schema.Types.ObjectId, ref: 'Plan' },
    sharedAt: Date,
    sharedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    wonAt: Date,
    lostAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

planSchema.index({ campaign: 1, versionNumber: 1 }, { unique: true });

export type PlanStatus = (typeof planStatuses)[number];
export type PlanSchema = InferSchemaType<typeof planSchema>;
export type PlanDocument = HydratedDocument<PlanSchema>;

export const PlanModel = mongoose.model<PlanSchema>('Plan', planSchema);
