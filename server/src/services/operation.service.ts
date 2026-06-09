import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import { mapOperationToDto } from '../dto/operation.dto.js';
import {
  operationItemStatuses,
  operationPriorities,
  operationStatuses,
} from '../models/operation.model.js';
import type {
  OperationDocument,
  OperationItemStatus,
  OperationPriority,
  OperationStatus,
} from '../models/operation.model.js';
import type { IOperationCounterRepository } from '../repositories/operationCounter.repository.js';
import type { IOperationRepository } from '../repositories/operation.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import type { UserRole } from '../models/user.model.js';
import { formatOperationCode, getOperationCounterKey } from '../utils/operationCode.js';
import {
  calculateImportantDates,
  calculateItemStatus,
  calculateOperationProgress,
  calculateOperationStatus,
} from '../utils/operationStatus.js';
import { HttpError } from '../utils/httpError.js';

export type OperationFilters = {
  status?: string;
  city?: string;
  categoryGroup?: string;
  operationOwner?: string;
  priority?: string;
  search?: string;
  mountingFrom?: string;
  mountingTo?: string;
  proofPending?: string;
  overdue?: string;
  page?: string;
  limit?: string;
};

type Actor = { userId: string; role: UserRole };
type Mutation = Record<string, unknown>;

export interface IOperationService {
  createOperationFromWonPlan(planId: string, userId: string): Promise<unknown>;
  list(filters: OperationFilters): Promise<unknown>;
  summary(): Promise<unknown>;
  getById(id: string): Promise<unknown>;
  getByPlan(planId: string): Promise<unknown>;
  update(id: string, input: Mutation, actor: Actor): Promise<unknown>;
  updateStatus(id: string, status: string, actor: Actor): Promise<unknown>;
  updateItem(id: string, itemId: string, input: Mutation, actorId: string): Promise<unknown>;
  updateCreative(id: string, itemId: string, input: Mutation, actorId: string): Promise<unknown>;
  updatePurchaseOrder(id: string, itemId: string, input: Mutation, actorId: string): Promise<unknown>;
  updateMounting(id: string, itemId: string, input: Mutation, actorId: string): Promise<unknown>;
  updateProof(id: string, itemId: string, input: Mutation, actorId: string): Promise<unknown>;
  updateTakedown(id: string, itemId: string, input: Mutation, actorId: string): Promise<unknown>;
}

const clean = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const booleanValue = (value: unknown) => (typeof value === 'boolean' ? value : undefined);
const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : undefined;
const objectId = (value?: string) =>
  value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;
const dateValue = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value as string | Date);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} is invalid`);
  return date;
};
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const positiveInt = (value: string | undefined, fallback: number, max?: number) => {
  const parsed = Number(value);
  const number = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  return max ? Math.min(number, max) : number;
};

@injectable()
export class OperationService implements IOperationService {
  constructor(
    @inject(TOKENS.OperationRepository)
    private readonly operations: IOperationRepository,
    @inject(TOKENS.OperationCounterRepository)
    private readonly counters: IOperationCounterRepository,
    @inject(TOKENS.PlanRepository)
    private readonly plans: IPlanRepository,
  ) {}

  async createOperationFromWonPlan(planId: string, userId: string) {
    this.validateId(planId, 'planId');
    const existing = await this.operations.findByPlan(planId);
    if (existing) return mapOperationToDto(existing);

    const plan = await this.plans.findByIdPopulated(planId);
    if (!plan) throw new HttpError(404, 'Plan not found');
    if (plan.status !== 'Won') throw new HttpError(400, 'Only won plans can create operations');

    const campaign = plan.campaign as any;
    const client = campaign.client as any;
    const year = new Date().getFullYear();
    const counter = await this.counters.incrementSequence(getOperationCounterKey(year), year);
    const actorId = objectId(userId);
    const items = (plan.items || []).map((item: any, index) => {
      const inventory = item.inventory && typeof item.inventory === 'object' ? item.inventory : undefined;
      const inventoryId = inventory?._id || item.inventory;
      const creative = { required: true, received: false, fileUrls: [] };
      const purchaseOrder = { required: true, sent: false };
      const mounting = { completed: false };
      const proof = { uploaded: false, photoUrls: [] };
      const takedown = {
        required: item.categoryGroup === 'Outdoor',
        scheduledDate: item.endDate,
        completed: false,
      };
      const operationItem = {
        planItemId:
          inventoryId?.toString?.() || item.inventoryCode || `plan-item-${index + 1}`,
        inventory: inventoryId,
        inventoryCode: item.inventoryCode,
        title: item.title,
        categoryGroup: item.categoryGroup,
        subCategory: item.subCategory,
        city: item.city,
        area: item.area,
        location: item.location?.toObject?.() || item.location,
        route: item.route,
        depot: item.depot,
        itinerary: item.itinerary,
        width: item.width,
        height: item.height,
        totalSqFt: item.totalSqFt,
        campaignStartDate: item.startDate,
        campaignEndDate: item.endDate,
        unitSellingPrice: item.unitSellingPrice || 0,
        totalSellingPrice: item.totalSellingPrice || 0,
        unitInternalCost: item.unitInternalCost || 0,
        totalInternalCost: item.totalInternalCost || 0,
        supplierName: inventory?.supplierName,
        ownerName: inventory?.ownerName,
        supplierEntity: inventory?.supplierEntity,
        ownerEntity: inventory?.ownerEntity,
        creative,
        purchaseOrder,
        mounting,
        proof,
        takedown,
        itemStatus: 'Creative Pending',
        notes: item.notes,
      };
      operationItem.itemStatus = calculateItemStatus(operationItem);
      return operationItem;
    });

    try {
      const operation = await this.operations.create({
        operationCode: formatOperationCode(year, counter.sequence),
        campaign: campaign._id,
        plan: plan._id,
        client: client?._id || client,
        planVersionLabel: plan.versionLabel,
        campaignCode: campaign.campaignCode,
        campaignTitle: campaign.title,
        clientName: client?.displayName || client?.name || 'Client',
        operationOwner: actorId,
        status: 'Pending',
        priority: 'Medium',
        items,
        overallProgress: calculateOperationProgress(items),
        importantDates: calculateImportantDates(items),
        createdBy: actorId,
        updatedBy: actorId,
      });
      return this.getById(operation._id.toString());
    } catch (error: any) {
      if (error?.code === 11000) {
        const duplicate = await this.operations.findByPlan(planId);
        if (duplicate) return mapOperationToDto(duplicate);
      }
      throw error;
    }
  }

  async list(filters: OperationFilters) {
    const page = positiveInt(filters.page, 1);
    const limit = positiveInt(filters.limit, 20, 100);
    const filter = this.buildFilter(filters);
    const result = await this.operations.findPaginated(filter, page, limit);
    return {
      data: result.items.map(mapOperationToDto),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.max(Math.ceil(result.total / limit), 1),
      },
    };
  }

  async summary() {
    const operations = await this.operations.findAll();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const allItems = operations.flatMap((operation) => operation.items || []);
    return {
      total: operations.length,
      pending: operations.filter((operation) => operation.status === 'Pending').length,
      inProgress: operations.filter((operation) => operation.status === 'In Progress').length,
      mounted: operations.filter((operation) => operation.status === 'Mounted').length,
      proofPending: operations.filter((operation) => operation.status === 'Proof Pending').length,
      completed: operations.filter((operation) => operation.status === 'Completed').length,
      overdueMountings: allItems.filter(
        (item) =>
          item.mounting?.scheduledDate &&
          item.mounting.scheduledDate < today &&
          !item.mounting.completed,
      ).length,
      proofPendingCount: allItems.filter(
        (item) => item.mounting?.completed && !item.proof?.uploaded,
      ).length,
      creativePendingCount: allItems.filter(
        (item) => item.creative?.required && !item.creative.received,
      ).length,
      poPendingCount: allItems.filter(
        (item) => item.purchaseOrder?.required && !item.purchaseOrder.sent,
      ).length,
    };
  }

  async getById(id: string) {
    const operation = await this.requireOperation(id);
    return mapOperationToDto(operation);
  }

  async getByPlan(planId: string) {
    this.validateId(planId, 'planId');
    const operation = await this.operations.findByPlan(planId);
    if (!operation) throw new HttpError(404, 'Operation not found');
    return mapOperationToDto(operation);
  }

  async update(id: string, input: Mutation, actor: Actor) {
    const operation = await this.requireOperation(id);
    if (input.operationOwner !== undefined) {
      const owner = clean(input.operationOwner);
      if (owner && !Types.ObjectId.isValid(owner)) throw new HttpError(400, 'operationOwner is invalid');
      operation.operationOwner = objectId(owner);
    }
    if (input.priority !== undefined) {
      if (!operationPriorities.includes(input.priority as OperationPriority)) {
        throw new HttpError(400, 'priority is invalid');
      }
      operation.priority = input.priority as OperationPriority;
    }
    if (input.status !== undefined) {
      this.applyOperationStatus(operation, input.status, actor.role);
    }
    if (input.notes !== undefined) operation.notes = clean(input.notes);
    if (input.importantDates && typeof input.importantDates === 'object') {
      const dates = input.importantDates as Mutation;
      operation.importantDates = {
        firstMountingDate: dateValue(dates.firstMountingDate, 'firstMountingDate'),
        lastMountingDate: dateValue(dates.lastMountingDate, 'lastMountingDate'),
        firstTakedownDate: dateValue(dates.firstTakedownDate, 'firstTakedownDate'),
        lastTakedownDate: dateValue(dates.lastTakedownDate, 'lastTakedownDate'),
      };
    }
    operation.updatedBy = objectId(actor.userId);
    await this.operations.save(operation);
    return this.getById(id);
  }

  async updateStatus(id: string, status: string, actor: Actor) {
    const operation = await this.requireOperation(id);
    this.applyOperationStatus(operation, status, actor.role);
    operation.updatedBy = objectId(actor.userId);
    await this.operations.save(operation);
    return this.getById(id);
  }

  async updateItem(id: string, itemId: string, input: Mutation, actorId: string) {
    const operation = await this.requireOperation(id);
    const item = this.requireItem(operation, itemId);
    if (input.notes !== undefined) item.notes = clean(input.notes);
    if (input.supplierName !== undefined) item.supplierName = clean(input.supplierName);
    if (input.ownerName !== undefined) item.ownerName = clean(input.ownerName);
    if (input.mountingScheduledDate !== undefined) {
      item.mounting.scheduledDate = dateValue(input.mountingScheduledDate, 'mountingScheduledDate');
    }
    if (input.takedownScheduledDate !== undefined) {
      item.takedown.scheduledDate = dateValue(input.takedownScheduledDate, 'takedownScheduledDate');
    }
    if (input.itemStatus !== undefined) {
      if (!operationItemStatuses.includes(input.itemStatus as OperationItemStatus)) {
        throw new HttpError(400, 'itemStatus is invalid');
      }
      item.itemStatus = input.itemStatus as OperationItemStatus;
    } else {
      item.itemStatus = calculateItemStatus(item);
    }
    await this.finishItemUpdate(operation, actorId);
    return this.getById(id);
  }

  async updateCreative(id: string, itemId: string, input: Mutation, actorId: string) {
    const { operation, item } = await this.operationItem(id, itemId);
    const required = booleanValue(input.required);
    const received = booleanValue(input.received);
    if (required !== undefined) item.creative.required = required;
    if (received !== undefined) {
      item.creative.received = received;
      item.creative.receivedAt = received ? new Date() : undefined;
    }
    const fileUrls = stringArray(input.fileUrls);
    if (fileUrls) item.creative.fileUrls = fileUrls;
    if (input.notes !== undefined) item.creative.notes = clean(input.notes);
    item.itemStatus = calculateItemStatus(item);
    await this.finishItemUpdate(operation, actorId);
    return this.getById(id);
  }

  async updatePurchaseOrder(id: string, itemId: string, input: Mutation, actorId: string) {
    const { operation, item } = await this.operationItem(id, itemId);
    const required = booleanValue(input.required);
    const sent = booleanValue(input.sent);
    if (required !== undefined) item.purchaseOrder.required = required;
    if (sent !== undefined) {
      item.purchaseOrder.sent = sent;
      item.purchaseOrder.sentAt = sent ? new Date() : undefined;
    }
    if (input.poNumber !== undefined) item.purchaseOrder.poNumber = clean(input.poNumber);
    if (input.poFileUrl !== undefined) item.purchaseOrder.poFileUrl = clean(input.poFileUrl);
    if (input.notes !== undefined) item.purchaseOrder.notes = clean(input.notes);
    item.itemStatus = calculateItemStatus(item);
    await this.finishItemUpdate(operation, actorId);
    return this.getById(id);
  }

  async updateMounting(id: string, itemId: string, input: Mutation, actorId: string) {
    const { operation, item } = await this.operationItem(id, itemId);
    if (input.scheduledDate !== undefined) {
      item.mounting.scheduledDate = dateValue(input.scheduledDate, 'scheduledDate');
    }
    const completed = booleanValue(input.completed);
    if (completed !== undefined) {
      item.mounting.completed = completed;
      item.mounting.completedAt = completed ? new Date() : undefined;
    }
    if (input.vendorNotes !== undefined) item.mounting.vendorNotes = clean(input.vendorNotes);
    if (input.internalNotes !== undefined) item.mounting.internalNotes = clean(input.internalNotes);
    item.itemStatus = calculateItemStatus(item);
    await this.finishItemUpdate(operation, actorId);
    return this.getById(id);
  }

  async updateProof(id: string, itemId: string, input: Mutation, actorId: string) {
    const { operation, item } = await this.operationItem(id, itemId);
    const uploaded = booleanValue(input.uploaded);
    if (uploaded !== undefined) {
      item.proof.uploaded = uploaded;
      item.proof.uploadedAt = uploaded ? new Date() : undefined;
    }
    const photoUrls = stringArray(input.photoUrls);
    if (photoUrls) item.proof.photoUrls = photoUrls;
    if (input.notes !== undefined) item.proof.notes = clean(input.notes);
    item.itemStatus = calculateItemStatus(item);
    await this.finishItemUpdate(operation, actorId);
    return this.getById(id);
  }

  async updateTakedown(id: string, itemId: string, input: Mutation, actorId: string) {
    const { operation, item } = await this.operationItem(id, itemId);
    const required = booleanValue(input.required);
    const completed = booleanValue(input.completed);
    if (required !== undefined) item.takedown.required = required;
    if (input.scheduledDate !== undefined) {
      item.takedown.scheduledDate = dateValue(input.scheduledDate, 'scheduledDate');
    }
    if (completed !== undefined) {
      item.takedown.completed = completed;
      item.takedown.completedAt = completed ? new Date() : undefined;
    }
    if (input.notes !== undefined) item.takedown.notes = clean(input.notes);
    item.itemStatus = calculateItemStatus(item);
    await this.finishItemUpdate(operation, actorId);
    return this.getById(id);
  }

  private buildFilter(filters: OperationFilters): FilterQuery<unknown> {
    const clauses: FilterQuery<unknown>[] = [];
    if (filters.status && operationStatuses.includes(filters.status as OperationStatus)) {
      clauses.push({ status: filters.status });
    }
    if (filters.priority && operationPriorities.includes(filters.priority as OperationPriority)) {
      clauses.push({ priority: filters.priority });
    }
    if (filters.operationOwner && Types.ObjectId.isValid(filters.operationOwner)) {
      clauses.push({ operationOwner: filters.operationOwner });
    }
    if (filters.city) clauses.push({ 'items.city': new RegExp(escapeRegex(filters.city), 'i') });
    if (filters.categoryGroup) clauses.push({ 'items.categoryGroup': filters.categoryGroup });
    if (filters.search?.trim()) {
      const search = new RegExp(escapeRegex(filters.search.trim()), 'i');
      clauses.push({
        $or: [
          { operationCode: search },
          { campaignCode: search },
          { campaignTitle: search },
          { clientName: search },
          { 'items.inventoryCode': search },
          { 'items.title': search },
          { 'items.city': search },
          { 'items.area': search },
        ],
      });
    }
    if (filters.proofPending === 'true') {
      clauses.push({ items: { $elemMatch: { 'mounting.completed': true, 'proof.uploaded': false } } });
    }
    if (filters.overdue === 'true') {
      clauses.push({
        items: {
          $elemMatch: {
            'mounting.scheduledDate': { $lt: new Date() },
            'mounting.completed': false,
          },
        },
      });
    }
    if (filters.mountingFrom || filters.mountingTo) {
      const range: Record<string, Date> = {};
      if (filters.mountingFrom) range.$gte = dateValue(filters.mountingFrom, 'mountingFrom') as Date;
      if (filters.mountingTo) range.$lte = dateValue(filters.mountingTo, 'mountingTo') as Date;
      clauses.push({ 'items.mounting.scheduledDate': range });
    }
    return clauses.length ? { $and: clauses } : {};
  }

  private applyOperationStatus(
    operation: OperationDocument,
    requestedStatus: unknown,
    role: UserRole,
  ) {
    if (!operationStatuses.includes(requestedStatus as OperationStatus)) {
      throw new HttpError(400, 'status is invalid');
    }
    if (requestedStatus === 'Cancelled' && role !== 'admin') {
      throw new HttpError(403, 'Only Admin can cancel operations');
    }
    operation.status = requestedStatus as OperationStatus;
  }

  private async operationItem(id: string, itemId: string) {
    const operation = await this.requireOperation(id);
    return { operation, item: this.requireItem(operation, itemId) };
  }

  private requireItem(operation: OperationDocument, itemId: string) {
    const item = (operation.items as any[]).find((candidate) => candidate._id.toString() === itemId);
    if (!item) throw new HttpError(404, 'Operation item not found');
    return item;
  }

  private async finishItemUpdate(operation: OperationDocument, actorId: string) {
    const items = operation.items as any[];
    operation.overallProgress = calculateOperationProgress(items);
    operation.importantDates = calculateImportantDates(items);
    operation.status = calculateOperationStatus(items, operation.status);
    operation.updatedBy = objectId(actorId);
    await this.operations.save(operation);
  }

  private async requireOperation(id: string) {
    this.validateId(id, 'operationId');
    const operation = await this.operations.findByIdPopulated(id);
    if (!operation) throw new HttpError(404, 'Operation not found');
    return operation;
  }

  private validateId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, `${field} is invalid`);
  }
}
