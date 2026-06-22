import { inject, injectable } from 'tsyringe';

import { TOKENS } from '../config/tokens.js';
import { INVENTORY_SUBCATEGORIES } from '../constants/import.constants.js';
import type {
  ImportIssue,
  ImportStoredRow,
  ImportType,
} from '../models/importJob.model.js';
import type { IContactRepository } from '../repositories/contact.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IGeocodingService, ReverseGeocodeResult } from './geocoding.service.js';
import { completeA3ScreenDimensions } from '../utils/a3ScreenDimensions.js';

export type ImportValidationResult = {
  rows: ImportStoredRow[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
};

const availabilityStatuses = ['available', 'booked', 'hold', 'unknown'];
const crmEntityTypes = ['Brand', 'Agency', 'Individual', 'SupplierOwner'];
const illuminationTypes = ['Lit', 'Non-lit', 'Backlit', 'Frontlit', 'NA'];

const text = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
};

const lower = (value: unknown) => text(value)?.toLowerCase();
const keyPart = (value: unknown) => lower(value) || '';

const issue = (
  rowNumber: number,
  field: string,
  message: string,
  value?: unknown,
): ImportIssue => ({
  rowNumber,
  field,
  message,
  value: text(value),
});

const parseNumber = (
  value: unknown,
  rowNumber: number,
  field: string,
  errors: ImportIssue[],
  required = false,
) => {
  const normalized = text(value);
  if (normalized === undefined) {
    if (required) errors.push(issue(rowNumber, field, `${field} is required`, value));
    return undefined;
  }
  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    errors.push(issue(rowNumber, field, `${field} must be numeric`, value));
    return undefined;
  }
  return number;
};

const parseBoolean = (
  value: unknown,
  rowNumber: number,
  field: string,
  errors: ImportIssue[],
) => {
  const normalized = lower(value);
  if (normalized === undefined) return undefined;
  if (['true', 'yes', '1'].includes(normalized)) return true;
  if (['false', 'no', '0'].includes(normalized)) return false;
  errors.push(issue(rowNumber, field, `${field} must be true/false, yes/no, or 1/0`, value));
  return undefined;
};

const parseTags = (value: unknown) =>
  (text(value) || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

const requiredText = (
  row: Record<string, unknown>,
  rowNumber: number,
  field: string,
  errors: ImportIssue[],
) => {
  const value = text(row[field]);
  if (!value) errors.push(issue(rowNumber, field, `${field} is required`, row[field]));
  return value;
};

const cleanObject = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

@injectable()
export class ImportValidatorsService {
  constructor(
    @inject(TOKENS.InventoryRepository)
    private readonly inventoryRepository: IInventoryRepository,
    @inject(TOKENS.CrmEntityRepository)
    private readonly crmEntityRepository: ICrmEntityRepository,
    @inject(TOKENS.ContactRepository)
    private readonly contactRepository: IContactRepository,
    @inject(TOKENS.GeocodingService)
    private readonly geocodingService: IGeocodingService,
  ) {}

  async validate(importType: ImportType, rawRows: Record<string, unknown>[]) {
    if (importType === 'inventory') return this.validateInventory(rawRows);
    if (importType === 'crm_entities') return this.validateCrmEntities(rawRows);
    return this.validateContacts(rawRows);
  }

  private summarize(rows: ImportStoredRow[]): ImportValidationResult {
    const errors = rows.flatMap((row) => row.errors || []);
    const warnings = rows.flatMap((row) => row.warnings || []);
    return {
      rows,
      errors,
      warnings,
      totalRows: rows.length,
      validRows: rows.filter((row) => row.status === 'valid').length,
      invalidRows: rows.filter((row) => row.status === 'invalid').length,
      duplicateRows: rows.filter((row) => row.status === 'duplicate').length,
    };
  }

  private async validateInventory(rawRows: Record<string, unknown>[]) {
    const existing = await this.inventoryRepository.find();
    const existingKeys = new Set(
      existing.map((item) =>
        this.inventoryDuplicateKey({
          categoryGroup: item.categoryGroup || item.category,
          subCategory: item.subCategory || item.subType,
          title: item.title,
          city: item.city,
          area: item.area,
          latitude: item.location?.latitude,
          longitude: item.location?.longitude,
        }),
      ),
    );
    const fileKeys = new Set<string>();
    // Map-based categories (Outdoor, A3 Screens) can fill missing location
    // fields from coordinates via reverse geocoding.
    const rowNeedsGeocoding = (row: Record<string, unknown>) => {
      const category = text(row.categoryGroup);
      if (category === 'A3 Screens') return !text(row.address) || !text(row.pinCode);
      if (category === 'Outdoor') {
        return !text(row.address) || !text(row.area) || !text(row.city);
      }
      return false;
    };
    const geocodingProvider = (process.env.GEOCODING_PROVIDER || 'nominatim').toLowerCase();
    const canUseMapbox =
      geocodingProvider === 'mapbox' &&
      Boolean(
        process.env.MAPBOX_ACCESS_TOKEN &&
          !process.env.MAPBOX_ACCESS_TOKEN.startsWith('your_'),
      );

    // Reverse geocoding is resolved up front, once per unique coordinate, so the
    // per-row pass below stays synchronous. Nominatim's public API allows ~1
    // request/second, so non-Mapbox lookups run sequentially with a delay; the
    // total number of lookups is capped to bound the request time.
    const coordKey = (latitude: number, longitude: number) => `${latitude},${longitude}`;
    const geocodeCache = await this.buildGeocodeCache(
      rawRows,
      rowNeedsGeocoding,
      coordKey,
      canUseMapbox,
    );

    const rows = await Promise.all(rawRows.map(async (raw, index): Promise<ImportStoredRow> => {
      const rowNumber = index + 2;
      const errors: ImportIssue[] = [];
      const warnings: ImportIssue[] = [];
      const categoryGroup = requiredText(raw, rowNumber, 'categoryGroup', errors);
      const subCategory = requiredText(raw, rowNumber, 'subCategory', errors);
      const propertyName = text(raw.propertyName);
      const title = text(raw.title) || (categoryGroup === 'A3 Screens' ? propertyName : undefined);
      // city/area can be filled from reverse geocoding for map categories, so
      // their "required" checks run after the geocoding step below.
      let city = text(raw.city) || (categoryGroup === 'A3 Screens' ? text(raw.zone) : undefined);
      let area = text(raw.area) || (categoryGroup === 'A3 Screens' ? text(raw.locality) : undefined);

      if (!title) errors.push(issue(rowNumber, 'title', 'title is required', raw.title));

      const screenSize = text(raw.screenSize);
      // Width/height are required for fixed-size media but optional for A3 Screens
      // (derived from screen size) and Mall / SOH (size is given only when known).
      const sizeRequired =
        categoryGroup !== 'A3 Screens' && categoryGroup !== 'Mall / SOH';
      const parsedWidth = parseNumber(raw.width, rowNumber, 'width', errors, sizeRequired);
      const parsedHeight = parseNumber(raw.height, rowNumber, 'height', errors, sizeRequired);
      const completedScreen =
        categoryGroup === 'A3 Screens'
          ? completeA3ScreenDimensions({
              screenSize,
              width: parsedWidth,
              height: parsedHeight,
            })
          : { screenSize, width: parsedWidth, height: parsedHeight };
      const width = completedScreen.width;
      const height = completedScreen.height;
      const completedScreenSize = completedScreen.screenSize;

      if (categoryGroup === 'A3 Screens') {
        if (width === undefined) {
          errors.push(issue(rowNumber, 'width', 'width could not be calculated'));
        }
        if (height === undefined) {
          errors.push(issue(rowNumber, 'height', 'height could not be calculated'));
        }
        if (!completedScreenSize) {
          errors.push(issue(rowNumber, 'screenSize', 'screenSize could not be calculated'));
        }
      }

      if (categoryGroup && !Object.hasOwn(INVENTORY_SUBCATEGORIES, categoryGroup)) {
        errors.push(issue(rowNumber, 'categoryGroup', 'categoryGroup is invalid', categoryGroup));
      } else if (
        categoryGroup &&
        subCategory &&
        !INVENTORY_SUBCATEGORIES[categoryGroup].includes(subCategory)
      ) {
        errors.push(
          issue(
            rowNumber,
            'subCategory',
            `subCategory is invalid for ${categoryGroup}`,
            subCategory,
          ),
        );
      }

      const availabilityStatus = lower(raw.availabilityStatus) || 'unknown';
      if (!availabilityStatuses.includes(availabilityStatus)) {
        errors.push(
          issue(
            rowNumber,
            'availabilityStatus',
            'availabilityStatus must be available, booked, hold, or unknown',
            raw.availabilityStatus,
          ),
        );
      }
      const illumination = text(raw.illumination);
      if (illumination && !illuminationTypes.includes(illumination)) {
        errors.push(
          issue(
            rowNumber,
            'illumination',
            'illumination must be Lit, Non-lit, Backlit, Frontlit, or NA',
            illumination,
          ),
        );
      }

      const latitude = parseNumber(
        raw.latitude,
        rowNumber,
        'latitude',
        errors,
        categoryGroup === 'Outdoor' || categoryGroup === 'A3 Screens',
      );
      const longitude = parseNumber(
        raw.longitude,
        rowNumber,
        'longitude',
        errors,
        categoryGroup === 'Outdoor' || categoryGroup === 'A3 Screens',
      );
      const isMapCategory =
        categoryGroup === 'Outdoor' || categoryGroup === 'A3 Screens';
      const suppliedAddress = text(raw.address);
      let address = suppliedAddress;
      let pinCode = text(raw.pinCode);

      const geocoded =
        isMapCategory && latitude !== undefined && longitude !== undefined
          ? geocodeCache.get(coordKey(latitude, longitude))
          : undefined;

      if (geocoded) {
        if (!area && geocoded.area) {
          area = geocoded.area;
          warnings.push(
            issue(rowNumber, 'area', 'area was filled from latitude and longitude', area),
          );
        }
        if (!city && geocoded.city) {
          city = geocoded.city;
          warnings.push(
            issue(rowNumber, 'city', 'city was filled from latitude and longitude', city),
          );
        }
        if (!address && geocoded.address) {
          address = geocoded.address;
          warnings.push(
            issue(rowNumber, 'address', 'address was filled from latitude and longitude', address),
          );
        }
        if (!pinCode && geocoded.pinCode) {
          pinCode = geocoded.pinCode;
          warnings.push(
            issue(rowNumber, 'pinCode', 'pinCode was filled from latitude and longitude', pinCode),
          );
        }
      }

      if (categoryGroup === 'A3 Screens' && !address) {
        address = [propertyName, area, city].filter(Boolean).join(', ');
        warnings.push(
          issue(
            rowNumber,
            'address',
            'address was built from property name, locality, and city because reverse geocoding was unavailable',
            address,
          ),
        );
      }
      if (categoryGroup === 'A3 Screens' && !pinCode) {
        warnings.push(
          issue(
            rowNumber,
            'pinCode',
            'pinCode could not be resolved automatically; add it later if required',
          ),
        );
      }

      // Outdoor inventory is located by its coordinates, so when reverse
      // geocoding cannot resolve the area/address, fall back to "NA" instead of
      // rejecting the row.
      if (
        categoryGroup === 'Outdoor' &&
        latitude !== undefined &&
        longitude !== undefined
      ) {
        if (!area) {
          area = 'NA';
          warnings.push(
            issue(rowNumber, 'area', 'area could not be resolved from coordinates; defaulted to NA'),
          );
        }
        if (!address) {
          address = 'NA';
          warnings.push(
            issue(rowNumber, 'address', 'address could not be resolved from coordinates; defaulted to NA'),
          );
        }
      }

      // Required-field checks for the location fields that geocoding may have
      // filled. Run here (after geocoding) so a row that supplies coordinates
      // but omits area/address is not rejected before we try to resolve them.
      if (!city) {
        errors.push(issue(rowNumber, 'city', 'city is required', raw.city || raw.zone));
      }
      if (!area) {
        errors.push(
          issue(
            rowNumber,
            categoryGroup === 'A3 Screens' ? 'locality' : 'area',
            categoryGroup === 'A3 Screens' ? 'locality is required' : 'area is required',
            raw.area || raw.locality,
          ),
        );
      }
      if (categoryGroup === 'Outdoor' && !address) {
        errors.push(issue(rowNumber, 'address', 'address is required', raw.address));
      }

      if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
        errors.push(issue(rowNumber, 'latitude', 'latitude must be between -90 and 90', latitude));
      }
      if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
        errors.push(
          issue(rowNumber, 'longitude', 'longitude must be between -180 and 180', longitude),
        );
      }

      const numberOfVehicles = parseNumber(
        raw.numberOfVehicles,
        rowNumber,
        'numberOfVehicles',
        errors,
      );
      const route = text(raw.route);
      const depot = text(raw.depot);
      const itinerary = text(raw.itinerary);
      if (categoryGroup === 'Auto' && !route && numberOfVehicles === undefined) {
        errors.push(
          issue(rowNumber, 'route', 'Auto inventory requires route or numberOfVehicles'),
        );
      }
      if (categoryGroup === 'Bus' && !route && !depot) {
        errors.push(issue(rowNumber, 'route', 'Bus inventory requires route or depot'));
      }
      if (categoryGroup === 'Mobile Van' && !itinerary) {
        errors.push(issue(rowNumber, 'itinerary', 'Mobile Van inventory requires itinerary'));
      }

      const a3RequiredTextFields = [
        'propertyName',
        'mediaSiteId',
        'propertyType',
        'nccsClass',
      ];
      if (categoryGroup === 'A3 Screens') {
        for (const field of a3RequiredTextFields) {
          if (!text(raw[field])) {
            errors.push(issue(rowNumber, field, `${field} is required`, raw[field]));
          }
        }
      }

      const numberOfScreens = parseNumber(
        raw.numberOfScreens,
        rowNumber,
        'numberOfScreens',
        errors,
        categoryGroup === 'A3 Screens',
      );
      const households = parseNumber(
        raw.households,
        rowNumber,
        'households',
        errors,
        categoryGroup === 'A3 Screens',
      );
      const approxReach = parseNumber(
        raw.approxReach,
        rowNumber,
        'approxReach',
        errors,
        categoryGroup === 'A3 Screens',
      );
      const monthlyImpressions = parseNumber(
        raw.monthlyImpressions,
        rowNumber,
        'monthlyImpressions',
        errors,
        categoryGroup === 'A3 Screens',
      );
      const monthlyAdBudget = parseNumber(
        raw.monthlyAdBudget,
        rowNumber,
        'monthlyAdBudget',
        errors,
        categoryGroup === 'A3 Screens',
      );
      const discountedMonthlyAdBudget = parseNumber(
        raw.discountedMonthlyAdBudget,
        rowNumber,
        'discountedMonthlyAdBudget',
        errors,
      );
      const explicitSellingPrice = parseNumber(
        raw.sellingPrice,
        rowNumber,
        'sellingPrice',
        errors,
        categoryGroup === 'A3 Screens',
      );
      const explicitInternalCost = parseNumber(
        raw.internalCost,
        rowNumber,
        'internalCost',
        errors,
        categoryGroup === 'A3 Screens',
      );

      // Mall / SOH availability date: a real future date resolves to ISO; free
      // text like "Immediate" or "Not Available" stays unset (status carries it).
      const availabilityDateValue = text(raw.availabilityDate);
      const availabilityDate = availabilityDateValue
        ? (() => {
            const date = new Date(availabilityDateValue);
            return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
          })()
        : undefined;

      const data = cleanObject({
        categoryGroup,
        subCategory,
        title,
        city,
        area,
        location:
          categoryGroup === 'Outdoor' || categoryGroup === 'A3 Screens'
            ? cleanObject({ address, latitude, longitude, source: 'manual' })
            : undefined,
        width,
        height,
        totalSqFt: width !== undefined && height !== undefined ? width * height : undefined,
        ownerName: text(raw.ownerName),
        ownerPhone: text(raw.ownerPhone),
        supplierName: text(raw.supplierName),
        internalCost:
          categoryGroup === 'A3 Screens'
            ? explicitInternalCost ?? discountedMonthlyAdBudget ?? monthlyAdBudget
            : explicitInternalCost,
        sellingPrice:
          explicitSellingPrice,
        minSpend: parseNumber(raw.minSpend, rowNumber, 'minSpend', errors),
        minDurationDays: parseNumber(
          raw.minDurationDays,
          rowNumber,
          'minDurationDays',
          errors,
        ),
        availabilityStatus: availabilityStatuses.includes(availabilityStatus)
          ? availabilityStatus
          : 'unknown',
        status: 'active',
        confirmationStatus: 'never_confirmed',
        tags: parseTags(raw.tags),
        internalNotes: text(raw.internalNotes),
        illumination,
        facingDirection: text(raw.facingDirection),
        trafficDirection: text(raw.trafficDirection),
        estimatedTraffic: text(raw.estimatedTraffic),
        loopLengthSeconds: parseNumber(
          raw.loopLengthSeconds,
          rowNumber,
          'loopLengthSeconds',
          errors,
        ),
        spotsPerHour: parseNumber(raw.spotsPerHour, rowNumber, 'spotsPerHour', errors),
        screenSpecs: text(raw.screenSpecs),
        numberOfVehicles,
        route,
        depot,
        brandingType: text(raw.brandingType),
        ratePerVehiclePerMonth: parseNumber(
          raw.ratePerVehiclePerMonth,
          rowNumber,
          'ratePerVehiclePerMonth',
          errors,
        ),
        operatorName: text(raw.operatorName),
        itinerary,
        operationDays: parseNumber(raw.operationDays, rowNumber, 'operationDays', errors),
        hasLedScreen: parseBoolean(raw.hasLedScreen, rowNumber, 'hasLedScreen', errors),
        hasAudioSystem: parseBoolean(raw.hasAudioSystem, rowNumber, 'hasAudioSystem', errors),
        hasCanopy: parseBoolean(raw.hasCanopy, rowNumber, 'hasCanopy', errors),
        ratePerDay: parseNumber(raw.ratePerDay, rowNumber, 'ratePerDay', errors),
        propertyName,
        phase: text(raw.phase),
        profile: text(raw.profile),
        pinCode,
        propertyPriceUptoCr: parseNumber(
          raw.propertyPriceUptoCr,
          rowNumber,
          'propertyPriceUptoCr',
          errors,
        ),
        screenSize: completedScreenSize,
        propertyVisualLink: text(raw.propertyVisualLink),
        numberOfScreens,
        households,
        approxReach,
        monthlyImpressions,
        monthlyAdBudget,
        discountedMonthlyAdBudget,
        mediaSiteId: text(raw.mediaSiteId),
        buildingAge: parseNumber(raw.buildingAge, rowNumber, 'buildingAge', errors),
        propertyType: text(raw.propertyType),
        nccsClass: text(raw.nccsClass),
        materialType: text(raw.materialType),
        siteLocationLabel: text(raw.siteLocationLabel),
        unitNumber: text(raw.unitNumber),
        visibilityNote: text(raw.visibilityNote),
        availabilityDate,
      });

      if (errors.length > 0) {
        return { rowNumber, status: 'invalid', data, errors, warnings };
      }

      const duplicateKey = this.inventoryDuplicateKey({
        categoryGroup,
        subCategory,
        title,
        city,
        area,
        latitude,
        longitude,
      });
      if (existingKeys.has(duplicateKey) || fileKeys.has(duplicateKey)) {
        warnings.push(
          issue(
            rowNumber,
            'duplicate',
            'Matching inventory already exists or appears earlier in this file',
            title,
          ),
        );
        return { rowNumber, status: 'duplicate', data, errors, warnings };
      }

      fileKeys.add(duplicateKey);
      return { rowNumber, status: 'valid', data, errors, warnings };
    }));

    return this.summarize(rows);
  }

  // Resolves every unique coordinate that needs geocoding into a cache, once per
  // location. Mapbox tolerates parallel requests; Nominatim is throttled to ~1
  // request/second, so those lookups run sequentially with a delay. The total
  // number of lookups is capped (IMPORT_GEOCODE_MAX_ROWS) to bound request time.
  private async buildGeocodeCache(
    rawRows: Record<string, unknown>[],
    rowNeedsGeocoding: (row: Record<string, unknown>) => boolean,
    coordKey: (latitude: number, longitude: number) => string,
    canUseMapbox: boolean,
  ) {
    const cache = new Map<string, ReverseGeocodeResult>();
    const coordinates = new Map<string, { latitude: number; longitude: number }>();
    for (const row of rawRows) {
      if (!rowNeedsGeocoding(row)) continue;
      const latitude = Number(text(row.latitude));
      const longitude = Number(text(row.longitude));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      coordinates.set(coordKey(latitude, longitude), { latitude, longitude });
    }
    if (!coordinates.size) return cache;

    const maxLookups = Number(process.env.IMPORT_GEOCODE_MAX_ROWS) || 100;
    const delayMs = canUseMapbox
      ? 0
      : Number(process.env.IMPORT_GEOCODE_DELAY_MS ?? 1000);
    const pending = [...coordinates.entries()].slice(0, maxLookups);

    if (canUseMapbox) {
      await Promise.all(
        pending.map(async ([key, point]) => {
          cache.set(key, await this.safeReverseGeocode(point.latitude, point.longitude));
        }),
      );
      return cache;
    }

    for (let index = 0; index < pending.length; index += 1) {
      const [key, point] = pending[index];
      if (index > 0 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      cache.set(key, await this.safeReverseGeocode(point.latitude, point.longitude));
    }
    return cache;
  }

  private async safeReverseGeocode(latitude: number, longitude: number) {
    try {
      return await this.geocodingService.reverseGeocode(latitude, longitude);
    } catch {
      return {} as ReverseGeocodeResult;
    }
  }

  private async validateCrmEntities(rawRows: Record<string, unknown>[]) {
    const existing = await this.crmEntityRepository.find();
    const emailKeys = new Set(existing.map((item) => lower(item.email)).filter(Boolean));
    const identityKeys = new Set(
      existing.map(
        (item) =>
          `${keyPart(item.entityType)}|${keyPart(item.name)}|${keyPart(item.address?.city)}`,
      ),
    );
    const fileEmailKeys = new Set<string>();
    const fileIdentityKeys = new Set<string>();

    const rows = rawRows.map((raw, index): ImportStoredRow => {
      const rowNumber = index + 2;
      const errors: ImportIssue[] = [];
      const warnings: ImportIssue[] = [];
      const entityType = requiredText(raw, rowNumber, 'entityType', errors);
      const name = requiredText(raw, rowNumber, 'name', errors);
      const email = lower(raw.email);
      const city = text(raw.city);

      if (entityType && !crmEntityTypes.includes(entityType)) {
        errors.push(issue(rowNumber, 'entityType', 'entityType is invalid', entityType));
      }

      const data = cleanObject({
        entityType,
        name,
        displayName: text(raw.displayName),
        email,
        phone: text(raw.phone),
        whatsapp: text(raw.whatsapp),
        website: text(raw.website),
        gstNumber: text(raw.gstNumber)?.toUpperCase(),
        panNumber: text(raw.panNumber)?.toUpperCase(),
        address: cleanObject({
          line1: text(raw.addressLine1),
          line2: text(raw.addressLine2),
          city,
          state: text(raw.state),
          pincode: text(raw.pincode),
          country: text(raw.country),
        }),
        billingDetails: cleanObject({
          legalName: text(raw.billingLegalName),
          gstNumber: text(raw.billingGstNumber)?.toUpperCase(),
          billingEmail: lower(raw.billingEmail),
          billingPhone: text(raw.billingPhone),
          billingAddress: text(raw.billingAddress),
        }),
        tags: parseTags(raw.tags),
        notes: text(raw.notes),
        status: 'active',
      });

      if (errors.length > 0) {
        return { rowNumber, status: 'invalid', data, errors, warnings };
      }

      const identityKey = `${keyPart(entityType)}|${keyPart(name)}|${keyPart(city)}`;
      const duplicate = email
        ? emailKeys.has(email) || fileEmailKeys.has(email)
        : identityKeys.has(identityKey) || fileIdentityKeys.has(identityKey);
      if (duplicate) {
        warnings.push(
          issue(
            rowNumber,
            email ? 'email' : 'name',
            'Matching CRM entity already exists or appears earlier in this file',
            email || name,
          ),
        );
        return { rowNumber, status: 'duplicate', data, errors, warnings };
      }

      if (email) fileEmailKeys.add(email);
      if (!email) fileIdentityKeys.add(identityKey);
      return { rowNumber, status: 'valid', data, errors, warnings };
    });

    return this.summarize(rows);
  }

  private async validateContacts(rawRows: Record<string, unknown>[]) {
    const [entities, contacts] = await Promise.all([
      this.crmEntityRepository.find(),
      this.contactRepository.find(),
    ]);
    const entitiesByEmail = new Map(
      entities
        .filter((entity) => lower(entity.email))
        .map((entity) => [lower(entity.email) as string, entity]),
    );
    const entitiesByName = new Map<string, typeof entities>();
    for (const entity of entities) {
      const nameKey = keyPart(entity.name);
      entitiesByName.set(nameKey, [...(entitiesByName.get(nameKey) || []), entity]);
    }

    const existingKeys = new Set(
      contacts.map((contact) => this.contactDuplicateKey(
        contact.crmEntity.toString(),
        contact.email,
        contact.name,
        contact.phone,
      )),
    );
    const fileKeys = new Set<string>();

    const rows = rawRows.map((raw, index): ImportStoredRow => {
      const rowNumber = index + 2;
      const errors: ImportIssue[] = [];
      const warnings: ImportIssue[] = [];
      const contactName = requiredText(raw, rowNumber, 'contactName', errors);
      const crmEntityEmail = lower(raw.crmEntityEmail);
      const crmEntityName = text(raw.crmEntityName);
      if (!crmEntityEmail && !crmEntityName) {
        errors.push(
          issue(
            rowNumber,
            'crmEntityName',
            'crmEntityName or crmEntityEmail is required',
          ),
        );
      }

      let entity = crmEntityEmail ? entitiesByEmail.get(crmEntityEmail) : undefined;
      if (!entity && crmEntityName) {
        const matches = entitiesByName.get(keyPart(crmEntityName)) || [];
        if (matches.length === 1) entity = matches[0];
        if (matches.length > 1) {
          errors.push(
            issue(
              rowNumber,
              'crmEntityName',
              'Multiple CRM entities use this name; provide crmEntityEmail',
              crmEntityName,
            ),
          );
        }
      }
      if (!entity && (crmEntityEmail || crmEntityName)) {
        errors.push(
          issue(
            rowNumber,
            crmEntityEmail ? 'crmEntityEmail' : 'crmEntityName',
            'CRM entity was not found',
            crmEntityEmail || crmEntityName,
          ),
        );
      }

      const isPrimary = parseBoolean(raw.isPrimary, rowNumber, 'isPrimary', errors) || false;
      const email = lower(raw.email);
      const phone = text(raw.phone);
      const data = cleanObject({
        crmEntityId: entity?._id.toString(),
        crmEntityName: entity?.name,
        name: contactName,
        role: text(raw.role),
        phone,
        email,
        whatsapp: text(raw.whatsapp),
        isPrimary,
        notes: text(raw.notes),
        status: 'active',
      });

      if (errors.length > 0) {
        return { rowNumber, status: 'invalid', data, errors, warnings };
      }

      const duplicateKey = this.contactDuplicateKey(
        entity?._id.toString() || '',
        email,
        contactName,
        phone,
      );
      if (existingKeys.has(duplicateKey) || fileKeys.has(duplicateKey)) {
        warnings.push(
          issue(
            rowNumber,
            email ? 'email' : 'contactName',
            'Matching contact already exists or appears earlier in this file',
            email || contactName,
          ),
        );
        return { rowNumber, status: 'duplicate', data, errors, warnings };
      }

      fileKeys.add(duplicateKey);
      return { rowNumber, status: 'valid', data, errors, warnings };
    });

    return this.summarize(rows);
  }

  private inventoryDuplicateKey(values: Record<string, unknown>) {
    const base = [
      values.categoryGroup,
      values.subCategory,
      values.title,
      values.city,
      values.area,
    ]
      .map(keyPart)
      .join('|');
    return values.categoryGroup === 'Outdoor' || values.categoryGroup === 'A3 Screens'
      ? `${base}|${values.latitude ?? ''}|${values.longitude ?? ''}`
      : base;
  }

  private contactDuplicateKey(
    entityId: string,
    email: unknown,
    name: unknown,
    phone: unknown,
  ) {
    return lower(email)
      ? `${entityId}|email|${lower(email)}`
      : `${entityId}|identity|${keyPart(name)}|${keyPart(phone)}`;
  }
}
