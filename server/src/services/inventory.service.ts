import { inject, injectable } from 'tsyringe';
import { parse } from 'csv-parse/sync';
import { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import { getEffectiveCategoryGroup, mapInventoryToDto } from '../dto/inventory.dto.js';
import type {
  ConfirmInventoryDto,
  InventoryDto,
  InventoryFiltersDto,
  InventoryImportResultDto,
  InventoryMutationDto,
  InventorySummaryDto,
} from '../dto/inventory.dto.js';
import { mapCsvRowToMutation } from '../utils/inventoryImport.js';
import {
  buildCounterKey,
  formatInventoryCode,
  getAreaCode,
  getCategoryCode,
  getCityCode,
} from '../utils/inventoryCode.js';
import {
  availabilityStatuses,
  categoryGroups,
  confirmationStatuses,
  illuminationTypes,
  inventoryStatuses,
  inventorySubCategoriesByGroup,
} from '../models/inventory.model.js';
import type {
  AvailabilityStatus,
  CategoryGroup,
  ConfirmationStatus,
  InventoryDocument,
  InventoryStatus,
  InventorySubCategory,
} from '../models/inventory.model.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IInventoryCounterRepository } from '../repositories/inventoryCounter.repository.js';
import { HttpError } from '../utils/httpError.js';

type PaginatedInventory = {
  data: InventoryDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export interface IInventoryService {
  getInventorySummary(): Promise<InventorySummaryDto[]>;
  listInventory(filters: InventoryFiltersDto): Promise<PaginatedInventory>;
  previewInventoryCode(categoryGroup?: string, city?: string, area?: string): Promise<string>;
  getInventoryById(id: string): Promise<InventoryDto>;
  createInventory(input: InventoryMutationDto): Promise<InventoryDto>;
  importInventory(buffer: Buffer, actorId: string): Promise<InventoryImportResultDto>;
  updateInventory(id: string, input: InventoryMutationDto): Promise<InventoryDto>;
  setInventoryStatus(id: string, status: InventoryStatus, updatedBy: string): Promise<InventoryDto>;
  confirmInventory(id: string, input: ConfirmInventoryDto): Promise<InventoryDto>;
}

const freshnessWindowDays = 30;
const searchFields = ['inventoryCode', 'title', 'city', 'area', 'ownerName', 'supplierName'];

const toObjectId = (value?: string) => (value ? new Types.ObjectId(value) : undefined);

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined);

const optionalNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const optionalBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
};

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

const validateEnum = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string,
) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (!allowedValues.includes(value as T)) {
    throw new HttpError(400, `${fieldName} is invalid`);
  }

  return value as T;
};

const getPage = (value?: string) => {
  const page = Number(value || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
};

const getLimit = (value?: string) => {
  const limit = Number(value || 20);

  if (!Number.isFinite(limit) || limit < 1) {
    return 20;
  }

  return Math.min(Math.floor(limit), 100);
};

const getStaleBefore = () => {
  const staleBefore = new Date();
  staleBefore.setDate(staleBefore.getDate() - freshnessWindowDays);
  return staleBefore;
};

export const getConfirmationStatus = (item: InventoryDocument): ConfirmationStatus => {
  if (!item.lastConfirmedAt) {
    return 'never_confirmed';
  }

  return item.lastConfirmedAt < getStaleBefore() ? 'stale' : 'fresh';
};

const mapToDto = (item: InventoryDocument) => mapInventoryToDto(item, getConfirmationStatus(item));

@injectable()
export class InventoryService implements IInventoryService {
  constructor(
    @inject(TOKENS.InventoryRepository)
    private readonly inventoryRepository: IInventoryRepository,
    @inject(TOKENS.InventoryCounterRepository)
    private readonly inventoryCounterRepository: IInventoryCounterRepository,
  ) {}

  async getInventorySummary() {
    const allItems = await this.inventoryRepository.find();
    const staleBefore = getStaleBefore();

    return categoryGroups.map((categoryGroup) => {
      const items = allItems.filter((item) => getEffectiveCategoryGroup(item) === categoryGroup);

      return {
        categoryGroup,
        total: items.length,
        available: items.filter(
          (item) => item.status === 'active' && item.availabilityStatus === 'available',
        ).length,
        stale: items.filter((item) => item.lastConfirmedAt && item.lastConfirmedAt < staleBefore).length,
        neverConfirmed: items.filter((item) => !item.lastConfirmedAt).length,
      };
    });
  }

  async listInventory(filters: InventoryFiltersDto) {
    const page = getPage(filters.page);
    const limit = getLimit(filters.limit);
    const filter = this.buildFilter(filters);
    const { items, total } = await this.inventoryRepository.findPaginated(filter, page, limit);

    return {
      data: items.map(mapToDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getInventoryById(id: string) {
    const item = await this.inventoryRepository.findById(id);

    if (!item) {
      throw new HttpError(404, 'Inventory item not found');
    }

    return mapToDto(item);
  }

  async previewInventoryCode(categoryGroup?: string, city?: string, area?: string) {
    const normalizedCategoryGroup = validateEnum(categoryGroup, categoryGroups, 'categoryGroup');
    const normalizedCity = trimString(city);
    const normalizedArea = trimString(area);

    if (!normalizedCategoryGroup || !normalizedCity || !normalizedArea) {
      throw new HttpError(400, 'categoryGroup, city, and area are required');
    }

    const key = buildCounterKey(normalizedCategoryGroup, normalizedCity, normalizedArea);
    const counter = await this.inventoryCounterRepository.findByKey(key);
    const nextSequence = (counter?.sequence || 0) + 1;

    return formatInventoryCode(normalizedCategoryGroup, normalizedCity, normalizedArea, nextSequence);
  }

  async createInventory(input: InventoryMutationDto) {
    const data = this.prepareMutation(input, true);
    const categoryGroup = data.categoryGroup as CategoryGroup;
    const city = data.city as string;
    const area = data.area as string;
    const key = buildCounterKey(categoryGroup, city, area);
    const counter = await this.inventoryCounterRepository.incrementSequence({
      key,
      categoryGroup: getCategoryCode(categoryGroup),
      cityCode: getCityCode(city),
      areaCode: getAreaCode(area),
    });

    const item = await this.inventoryRepository.create({
      ...data,
      inventoryCode: formatInventoryCode(categoryGroup, city, area, counter.sequence),
    });

    return mapToDto(item);
  }

  async importInventory(buffer: Buffer, actorId: string): Promise<InventoryImportResultDto> {
    let records: Record<string, string>[];

    try {
      records = parse(buffer, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
    } catch {
      throw new HttpError(400, 'Unable to parse CSV file. Check the file format and try again.');
    }

    const result: InventoryImportResultDto = {
      total: 0,
      created: 0,
      failed: 0,
      createdCodes: [],
      errors: [],
    };

    for (let index = 0; index < records.length; index += 1) {
      const mutation = mapCsvRowToMutation(records[index], actorId);

      if (!mutation) {
        continue;
      }

      // Row number accounts for the header line so it matches the spreadsheet.
      const rowNumber = index + 2;
      result.total += 1;

      try {
        const created = await this.createInventory(mutation);
        result.created += 1;
        result.createdCodes.push(created.inventoryCode);
      } catch (error) {
        result.failed += 1;
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Failed to import row',
        });
      }
    }

    return result;
  }

  async updateInventory(id: string, input: InventoryMutationDto) {
    const item = await this.getInventoryDocument(id);
    const data = this.prepareMutation(input, false);

    Object.assign(item, data);
    const savedItem = await this.inventoryRepository.save(item);

    return mapToDto(savedItem);
  }

  async setInventoryStatus(id: string, status: InventoryStatus, updatedBy: string) {
    const item = await this.getInventoryDocument(id);
    item.status = status;
    item.updatedBy = toObjectId(updatedBy);

    const savedItem = await this.inventoryRepository.save(item);
    return mapToDto(savedItem);
  }

  async confirmInventory(id: string, input: ConfirmInventoryDto) {
    const item = await this.getInventoryDocument(id);

    item.lastConfirmedAt = new Date();
    item.confirmedBy = toObjectId(input.confirmedBy);
    item.updatedBy = toObjectId(input.confirmedBy);
    item.confirmationNote = trimString(input.confirmationNote);

    if (input.availabilityStatus !== undefined) {
      item.availabilityStatus = validateEnum(
        input.availabilityStatus,
        availabilityStatuses,
        'availabilityStatus',
      ) as AvailabilityStatus;
    }

    if (input.internalCost !== undefined) {
      item.internalCost = optionalNumber(input.internalCost);
    }

    if (input.sellingPrice !== undefined) {
      item.sellingPrice = optionalNumber(input.sellingPrice);
    }

    const savedItem = await this.inventoryRepository.save(item);
    return mapToDto(savedItem);
  }

  private async getInventoryDocument(id: string) {
    const item = await this.inventoryRepository.findById(id);

    if (!item) {
      throw new HttpError(404, 'Inventory item not found');
    }

    return item;
  }

  private buildFilter(filters: InventoryFiltersDto) {
    const filter: FilterQuery<unknown> = {};
    const andConditions: FilterQuery<unknown>[] = [];

    if (filters.categoryGroup) {
      const categoryGroup = validateEnum(filters.categoryGroup, categoryGroups, 'categoryGroup');

      andConditions.push({
        $or: [
          { categoryGroup },
          ...(categoryGroup === 'Outdoor' ? [{ category: { $in: ['OOH', 'DOOH'] } }] : []),
        ],
      });
    }

    if (filters.subCategory) {
      filter.subCategory = filters.subCategory;
    }

    if (filters.city) {
      filter.city = new RegExp(filters.city, 'i');
    }

    if (filters.area) {
      filter.area = new RegExp(filters.area, 'i');
    }

    if (filters.status) {
      filter.status = validateEnum(filters.status, inventoryStatuses, 'status');
    }

    if (filters.availabilityStatus) {
      filter.availabilityStatus = validateEnum(
        filters.availabilityStatus,
        availabilityStatuses,
        'availabilityStatus',
      );
    }

    if (filters.confirmationStatus) {
      const confirmationStatus = validateEnum(
        filters.confirmationStatus,
        confirmationStatuses,
        'confirmationStatus',
      );
      const confirmationFilter = this.getConfirmationFilter(confirmationStatus);

      if (Object.keys(confirmationFilter).length > 0) {
        andConditions.push(confirmationFilter);
      }
    }

    const search = trimString(filters.search);

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      andConditions.push({
        $or: searchFields.map((field) => ({ [field]: searchRegex })),
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    return filter;
  }

  private getConfirmationFilter(status?: ConfirmationStatus) {
    if (!status) {
      return {};
    }

    if (status === 'never_confirmed') {
      return {
        $or: [{ lastConfirmedAt: { $exists: false } }, { lastConfirmedAt: null }],
      };
    }

    if (status === 'stale') {
      return { lastConfirmedAt: { $lt: getStaleBefore() } };
    }

    return { lastConfirmedAt: { $gte: getStaleBefore() } };
  }

  private prepareMutation(input: InventoryMutationDto, isCreate: boolean) {
    const categoryGroup = validateEnum(input.categoryGroup, categoryGroups, 'categoryGroup');
    const subCategory = this.validateSubCategory(categoryGroup, input.subCategory);
    const availabilityStatus = validateEnum(
      input.availabilityStatus,
      availabilityStatuses,
      'availabilityStatus',
    );
    const status = validateEnum(input.status, inventoryStatuses, 'status');
    const illumination = validateEnum(input.illumination, illuminationTypes, 'illumination');

    const data: Record<string, unknown> = {
      categoryGroup,
      subCategory,
      title: trimString(input.title),
      city: trimString(input.city),
      area: trimString(input.area),
      photos: normalizeStringArray(input.photos),
      ownerName: trimString(input.ownerName),
      ownerPhone: trimString(input.ownerPhone),
      supplierName: trimString(input.supplierName),
      internalCost: optionalNumber(input.internalCost),
      sellingPrice: optionalNumber(input.sellingPrice),
      minSpend: optionalNumber(input.minSpend),
      minDurationDays: optionalNumber(input.minDurationDays),
      availabilityStatus,
      status,
      tags: normalizeStringArray(input.tags),
      internalNotes: trimString(input.internalNotes),
      width: optionalNumber(input.width),
      height: optionalNumber(input.height),
      illumination,
      facingDirection: trimString(input.facingDirection),
      trafficDirection: trimString(input.trafficDirection),
      estimatedTraffic: trimString(input.estimatedTraffic),
      loopLengthSeconds: optionalNumber(input.loopLengthSeconds),
      spotsPerHour: optionalNumber(input.spotsPerHour),
      screenSpecs: trimString(input.screenSpecs),
      numberOfVehicles: optionalNumber(input.numberOfVehicles),
      route: trimString(input.route),
      depot: trimString(input.depot),
      brandingType: trimString(input.brandingType),
      ratePerVehiclePerMonth: optionalNumber(input.ratePerVehiclePerMonth),
      operatorName: trimString(input.operatorName),
      itinerary: trimString(input.itinerary),
      operationDays: optionalNumber(input.operationDays),
      hasLedScreen: optionalBoolean(input.hasLedScreen),
      hasAudioSystem: optionalBoolean(input.hasAudioSystem),
      hasCanopy: optionalBoolean(input.hasCanopy),
      ratePerDay: optionalNumber(input.ratePerDay),
      updatedBy: toObjectId(input.updatedBy),
    };

    if (categoryGroup === 'Outdoor') {
      data.location = {
        latitude: optionalNumber(input.location?.latitude),
        longitude: optionalNumber(input.location?.longitude),
        address: trimString(input.location?.address),
        source: validateEnum(
          input.location?.source,
          ['manual', 'map_picker', 'reverse_geocode'] as const,
          'location.source',
        ),
      };
    }

    if (isCreate) {
      data.createdBy = toObjectId(input.createdBy);
    }

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });

    this.validateRequiredFields(data);
    this.validateCategoryRequirements(data);

    return data as InventoryMutationDto;
  }

  private validateSubCategory(categoryGroup?: CategoryGroup, subCategory?: InventorySubCategory) {
    if (!subCategory) {
      return undefined;
    }

    if (!categoryGroup) {
      throw new HttpError(400, 'categoryGroup is required before subCategory can be validated');
    }

    const allowedSubCategories = inventorySubCategoriesByGroup[categoryGroup] as readonly string[];

    if (!allowedSubCategories.includes(subCategory)) {
      throw new HttpError(400, 'subCategory is invalid for the selected categoryGroup');
    }

    return subCategory;
  }

  private validateRequiredFields(data: Record<string, unknown>) {
    const requiredFields = ['categoryGroup', 'subCategory', 'title', 'city', 'area', 'width', 'height'];

    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === '') {
        throw new HttpError(400, `${field} is required`);
      }
    }
  }

  private validateCategoryRequirements(data: Record<string, unknown>) {
    if (data.categoryGroup === 'Outdoor') {
      const location = data.location as
        | { latitude?: number; longitude?: number; address?: string }
        | undefined;

      if (
        location?.latitude === undefined ||
        location.longitude === undefined ||
        !location.address
      ) {
        throw new HttpError(400, 'Outdoor inventory requires address, latitude, and longitude');
      }
    }

    if (data.categoryGroup === 'Auto' && !data.numberOfVehicles && !data.route) {
      throw new HttpError(400, 'Auto inventory requires numberOfVehicles or route');
    }

    if (data.categoryGroup === 'Bus' && !data.route && !data.depot) {
      throw new HttpError(400, 'Bus inventory requires route or depot');
    }

    if (data.categoryGroup === 'Mobile Van' && !data.itinerary) {
      throw new HttpError(400, 'Mobile Van inventory requires itinerary');
    }
  }
}
