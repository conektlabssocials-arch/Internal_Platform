import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const MEMBER_PERMISSION_KEYS = [
  'inventory.create',
  'inventory.edit',
  'inventory.confirm',
  'crm.manage',
  'campaigns.manage',
  'plans.manage',
  'operations.manage',
  'documents.generate',
  'shares.manage',
  'uploads.manage',
] as const;

export type MemberPermission = (typeof MEMBER_PERMISSION_KEYS)[number];

export const DEFAULT_MEMBER_PERMISSIONS: Record<MemberPermission, boolean> = {
  'inventory.create': false,
  'inventory.edit': true,
  'inventory.confirm': true,
  'crm.manage': true,
  'campaigns.manage': true,
  'plans.manage': true,
  'operations.manage': true,
  'documents.generate': true,
  'shares.manage': true,
  'uploads.manage': true,
};

export const MEMBER_PERMISSION_FIELDS: Record<MemberPermission, string> = {
  'inventory.create': 'inventoryCreate',
  'inventory.edit': 'inventoryEdit',
  'inventory.confirm': 'inventoryConfirm',
  'crm.manage': 'crmManage',
  'campaigns.manage': 'campaignsManage',
  'plans.manage': 'plansManage',
  'operations.manage': 'operationsManage',
  'documents.generate': 'documentsGenerate',
  'shares.manage': 'sharesManage',
  'uploads.manage': 'uploadsManage',
};

const defaultStoredPermissions = Object.fromEntries(
  MEMBER_PERMISSION_KEYS.map((permission) => [
    MEMBER_PERMISSION_FIELDS[permission],
    DEFAULT_MEMBER_PERMISSIONS[permission],
  ]),
);

const permissions = Object.fromEntries(
  MEMBER_PERMISSION_KEYS.map((key) => [
    MEMBER_PERMISSION_FIELDS[key],
    { type: Boolean, default: DEFAULT_MEMBER_PERMISSIONS[key] },
  ]),
);

const platformSettingsSchema = new Schema(
  {
    key: {
      type: String,
      unique: true,
      default: 'default',
    },
    memberPermissions: {
      type: new Schema(permissions, { _id: false }),
      default: () => ({ ...defaultStoredPermissions }),
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

export type PlatformSettingsSchema = InferSchemaType<typeof platformSettingsSchema>;
export type PlatformSettingsDocument = HydratedDocument<PlatformSettingsSchema>;

export const PlatformSettingsModel = mongoose.model<PlatformSettingsSchema>(
  'PlatformSettings',
  platformSettingsSchema,
);
