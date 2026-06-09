import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';
import type { Request } from 'express';

import { TOKENS } from '../config/tokens.js';
import { activityActionLabel } from '../constants/activity.constants.js';
import { ActivityLogModel, activityEntityTypes } from '../models/activityLog.model.js';
import type { IUserRepository } from '../repositories/user.repository.js';
import { HttpError } from '../utils/httpError.js';

type Actor = { userId?: string; email?: string; role?: string; name?: string } | null;
type Change = { field: string; from: unknown; to: unknown };
type LogPayload = {
  actor?: Actor;
  actorName?: string;
  action: string;
  actionLabel?: string;
  entityType: string;
  entityId?: string;
  entityCode?: string;
  entityTitle?: string;
  parentEntityType?: string;
  parentEntityId?: string;
  parentEntityCode?: string;
  message: string;
  changes?: Change[];
  metadata?: Record<string, unknown>;
  visibility?: 'internal' | 'admin_only';
  req?: Request;
};

export interface IActivityService {
  logEntityActivity(payload: LogPayload): Promise<void>;
  buildChangeSet(before: any, after: any, fields: string[]): Change[];
  getActivities(filters: Record<string, string | undefined>, includeAdmin?: boolean): Promise<unknown>;
  getEntityActivities(entityType: string, entityId: string, page?: string, limit?: string): Promise<unknown>;
}

const forbidden = /password|token|secret|cookie|authorization|jwt/i;
const getPath = (value: any, path: string) =>
  path.split('.').reduce((current, key) => current?.[key], value);
const simplify = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    const text = JSON.stringify(value);
    return text.length > 500 ? `${text.slice(0, 500)}...` : JSON.parse(text);
  }
  return value;
};
const pageNumber = (value?: string, fallback = 1) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
};

@injectable()
export class ActivityService implements IActivityService {
  constructor(
    @inject(TOKENS.UserRepository)
    private readonly users: IUserRepository,
  ) {}

  async logEntityActivity(payload: LogPayload) {
    try {
      let actorName = payload.actorName || payload.actor?.name;
      let actorEmail = payload.actor?.email;
      let actorRole = payload.actor?.role;
      if (payload.actor?.userId && Types.ObjectId.isValid(payload.actor.userId)) {
        const user = await this.users.findById(payload.actor.userId);
        actorName ||= user?.name;
        actorEmail ||= user?.email;
        actorRole ||= user?.role;
      }
      await ActivityLogModel.create({
        actor: payload.actor?.userId && Types.ObjectId.isValid(payload.actor.userId)
          ? new Types.ObjectId(payload.actor.userId) : undefined,
        actorName: actorName || 'System',
        actorEmail,
        actorRole,
        action: payload.action,
        actionLabel: payload.actionLabel || activityActionLabel(payload.action),
        entityType: payload.entityType,
        entityId: payload.entityId && Types.ObjectId.isValid(payload.entityId)
          ? new Types.ObjectId(payload.entityId) : undefined,
        entityCode: payload.entityCode,
        entityTitle: payload.entityTitle,
        parentEntityType: payload.parentEntityType,
        parentEntityId: payload.parentEntityId && Types.ObjectId.isValid(payload.parentEntityId)
          ? new Types.ObjectId(payload.parentEntityId) : undefined,
        parentEntityCode: payload.parentEntityCode,
        message: payload.message,
        changes: (payload.changes || []).filter((change) => !forbidden.test(change.field)),
        metadata: Object.fromEntries(
          Object.entries(payload.metadata || {}).filter(([key]) => !forbidden.test(key)),
        ),
        visibility: payload.visibility || 'internal',
        ipAddress: payload.req?.ip,
        userAgent: payload.req?.headers['user-agent']?.slice(0, 500),
      });
    } catch (error) {
      console.error('Activity log failed', error);
    }
  }

  buildChangeSet(before: any, after: any, fields: string[]) {
    return fields
      .filter((field) => !forbidden.test(field))
      .flatMap((field) => {
        const from = simplify(getPath(before, field));
        const to = simplify(getPath(after, field));
        return JSON.stringify(from) === JSON.stringify(to) ? [] : [{ field, from, to }];
      });
  }

  async getActivities(filters: Record<string, string | undefined>, includeAdmin = false) {
    const page = pageNumber(filters.page);
    const limit = Math.min(pageNumber(filters.limit, 20), 100);
    const query: any = includeAdmin ? {} : { visibility: 'internal' };
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.action) query.action = filters.action;
    if (filters.actor && Types.ObjectId.isValid(filters.actor)) query.actor = filters.actor;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) query.createdAt.$gte = new Date(filters.from);
      if (filters.to) query.createdAt.$lte = new Date(`${filters.to}T23:59:59.999`);
    }
    if (filters.search) {
      const search = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ message: search }, { entityCode: search }, { entityTitle: search }, { actorName: search }];
    }
    const [items, total] = await Promise.all([
      ActivityLogModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityLogModel.countDocuments(query),
    ]);
    return { data: items.map(this.map), pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } };
  }

  async getEntityActivities(entityType: string, entityId: string, page?: string, limit?: string) {
    if (!activityEntityTypes.includes(entityType as any)) throw new HttpError(400, 'entityType is invalid');
    if (!Types.ObjectId.isValid(entityId)) throw new HttpError(400, 'entityId is invalid');
    const p = pageNumber(page);
    const l = Math.min(pageNumber(limit, 20), 100);
    const objectId = new Types.ObjectId(entityId);
    const query = {
      visibility: 'internal',
      $or: [
        { entityType, entityId: objectId },
        { parentEntityType: entityType, parentEntityId: objectId },
      ],
    };
    const [items, total] = await Promise.all([
      ActivityLogModel.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
      ActivityLogModel.countDocuments(query),
    ]);
    return { data: items.map(this.map), pagination: { page: p, limit: l, total, totalPages: Math.max(Math.ceil(total / l), 1) } };
  }

  private map = (item: any) => ({
    id: item._id.toString(), actor: item.actor?.toString(), actorName: item.actorName,
    actorEmail: item.actorEmail, actorRole: item.actorRole, action: item.action,
    actionLabel: item.actionLabel, entityType: item.entityType,
    entityId: item.entityId?.toString(), entityCode: item.entityCode, entityTitle: item.entityTitle,
    parentEntityType: item.parentEntityType, parentEntityId: item.parentEntityId?.toString(),
    parentEntityCode: item.parentEntityCode, message: item.message, changes: item.changes || [],
    metadata: item.metadata || {}, visibility: item.visibility, ipAddress: item.ipAddress,
    userAgent: item.userAgent, createdAt: item.createdAt,
  });
}
