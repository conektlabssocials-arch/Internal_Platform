import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const activityEntityTypes = [
  'User',
  'Inventory',
  'CRM',
  'Contact',
  'Campaign',
  'Plan',
  'Document',
  'Share',
  'Operation',
  'OperationItem',
  'System',
] as const;

const changeSchema = new Schema(
  { field: String, from: Schema.Types.Mixed, to: Schema.Types.Mixed },
  { _id: false },
);

const activityLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    actorEmail: String,
    actorRole: String,
    action: { type: String, required: true, index: true },
    actionLabel: String,
    entityType: { type: String, enum: activityEntityTypes, required: true, index: true },
    entityId: Schema.Types.ObjectId,
    entityCode: String,
    entityTitle: String,
    parentEntityType: String,
    parentEntityId: Schema.Types.ObjectId,
    parentEntityCode: String,
    message: { type: String, required: true },
    changes: { type: [changeSchema], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    visibility: { type: String, enum: ['internal', 'admin_only'], default: 'internal' },
    ipAddress: String,
    userAgent: String,
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ actor: 1, createdAt: -1 });

export type ActivityLogSchema = InferSchemaType<typeof activityLogSchema>;
export type ActivityLogDocument = HydratedDocument<ActivityLogSchema>;
export const ActivityLogModel = mongoose.model<ActivityLogSchema>(
  'ActivityLog',
  activityLogSchema,
);
