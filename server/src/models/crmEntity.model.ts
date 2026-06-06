import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const crmEntityTypes = ['Brand', 'Agency', 'Individual', 'SupplierOwner'] as const;
export const crmEntityStatuses = ['active', 'inactive'] as const;

const addressSchema = new Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false },
);

const billingDetailsSchema = new Schema(
  {
    legalName: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    billingEmail: { type: String, lowercase: true, trim: true },
    billingPhone: { type: String, trim: true },
    billingAddress: { type: String, trim: true },
  },
  { _id: false },
);

const crmEntitySchema = new Schema(
  {
    entityType: {
      type: String,
      enum: crmEntityTypes,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    website: { type: String, trim: true },
    address: addressSchema,
    billingDetails: billingDetailsSchema,
    ownerUser: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: crmEntityStatuses,
      default: 'active',
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: { type: String, trim: true },
    files: {
      type: [String],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

crmEntitySchema.index({ entityType: 1, status: 1, name: 1 });
crmEntitySchema.index({ 'address.city': 1 });

export type CrmEntityType = (typeof crmEntityTypes)[number];
export type CrmEntityStatus = (typeof crmEntityStatuses)[number];
export type CrmEntitySchema = InferSchemaType<typeof crmEntitySchema>;
export type CrmEntityDocument = HydratedDocument<CrmEntitySchema>;

export const CrmEntityModel = mongoose.model<CrmEntitySchema>('CrmEntity', crmEntitySchema);
