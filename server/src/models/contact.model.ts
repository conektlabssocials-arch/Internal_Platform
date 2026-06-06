import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const contactStatuses = ['active', 'inactive'] as const;

const contactSchema = new Schema(
  {
    crmEntity: {
      type: Schema.Types.ObjectId,
      ref: 'CrmEntity',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    whatsapp: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: contactStatuses,
      default: 'active',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

contactSchema.index(
  { crmEntity: 1, isPrimary: 1 },
  {
    unique: true,
    partialFilterExpression: { isPrimary: true },
  },
);

export type ContactStatus = (typeof contactStatuses)[number];
export type ContactSchema = InferSchemaType<typeof contactSchema>;
export type ContactDocument = HydratedDocument<ContactSchema>;

export const ContactModel = mongoose.model<ContactSchema>('Contact', contactSchema);
