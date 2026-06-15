import { apiRequest } from './apiClient';
import type {
  EffectiveAccess,
  MemberPermission,
  PlatformSettings,
} from '../types/platformSettings';

export const getEffectiveAccess = async () =>
  (await apiRequest<{ data: EffectiveAccess }>('/platform-settings/access')).data;

export const getPlatformSettings = async () =>
  (await apiRequest<{ data: PlatformSettings }>('/platform-settings')).data;

export const updatePlatformSettings = async (
  memberPermissions: Partial<Record<MemberPermission, boolean>>,
) =>
  (
    await apiRequest<{ data: PlatformSettings }>('/platform-settings', {
      method: 'PATCH',
      body: {
        memberPermissions: Object.entries(memberPermissions).map(
          ([permission, enabled]) => ({ permission, enabled }),
        ),
      },
    })
  ).data;
