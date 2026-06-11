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

export type PlatformSettings = {
  memberPermissions: Record<MemberPermission, boolean>;
  updatedAt?: string;
};

export type EffectiveAccess = {
  role: 'admin' | 'member';
  permissions: Record<MemberPermission, boolean>;
};
