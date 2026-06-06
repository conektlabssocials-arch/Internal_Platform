import type { InventoryMutationDto } from '../dto/inventory.dto.js';

// Canonical CSV columns, in the order they appear in the downloadable template.
// Header matching is case-insensitive and ignores spaces/underscores.
export const IMPORT_COLUMNS = [
  'categoryGroup',
  'subCategory',
  'title',
  'city',
  'area',
  'latitude',
  'longitude',
  'address',
  'width',
  'height',
  'internalCost',
  'sellingPrice',
  'minSpend',
  'minDurationDays',
  'availabilityStatus',
  'status',
  'ownerName',
  'ownerPhone',
  'supplierName',
  'photos',
  'tags',
  'internalNotes',
  'illumination',
  'facingDirection',
  'trafficDirection',
  'estimatedTraffic',
  'loopLengthSeconds',
  'spotsPerHour',
  'screenSpecs',
  'numberOfVehicles',
  'route',
  'depot',
  'brandingType',
  'ratePerVehiclePerMonth',
  'operatorName',
  'itinerary',
  'operationDays',
  'hasLedScreen',
  'hasAudioSystem',
  'hasCanopy',
  'ratePerDay',
] as const;

const LOCATION_FIELDS = ['latitude', 'longitude', 'address'] as const;
const LIST_FIELDS = ['photos', 'tags'] as const;
const BOOLEAN_FIELDS = ['hasLedScreen', 'hasAudioSystem', 'hasCanopy'] as const;

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

const columnByNormalizedHeader = new Map(
  IMPORT_COLUMNS.map((column) => [normalizeHeader(column), column] as const),
);

const parseBoolean = (value: string) => {
  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return undefined;
};

const parseList = (value: string) =>
  value
    .split(value.includes('|') ? '|' : ',')
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Maps a raw CSV record (keyed by header) into an inventory mutation payload.
 * Returns null when the row is entirely empty. Type coercion for numbers and
 * enums is left to the inventory service, which already validates them.
 */
export const mapCsvRowToMutation = (
  record: Record<string, string>,
  actorId: string,
): InventoryMutationDto | null => {
  const values: Partial<Record<(typeof IMPORT_COLUMNS)[number], string>> = {};

  for (const [rawKey, rawValue] of Object.entries(record)) {
    const column = columnByNormalizedHeader.get(normalizeHeader(rawKey));

    if (!column) {
      continue;
    }

    const value = typeof rawValue === 'string' ? rawValue.trim() : '';

    if (value !== '') {
      values[column] = value;
    }
  }

  if (Object.keys(values).length === 0) {
    return null;
  }

  const mutation: Record<string, unknown> = {
    createdBy: actorId,
    updatedBy: actorId,
  };

  const skip = new Set<string>([...LOCATION_FIELDS, ...LIST_FIELDS, ...BOOLEAN_FIELDS]);

  for (const column of IMPORT_COLUMNS) {
    if (skip.has(column) || values[column] === undefined) {
      continue;
    }

    mutation[column] = values[column];
  }

  for (const field of LIST_FIELDS) {
    if (values[field] !== undefined) {
      mutation[field] = parseList(values[field]);
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    if (values[field] !== undefined) {
      const parsed = parseBoolean(values[field]);

      if (parsed !== undefined) {
        mutation[field] = parsed;
      }
    }
  }

  if (LOCATION_FIELDS.some((field) => values[field] !== undefined)) {
    mutation.location = {
      latitude: values.latitude,
      longitude: values.longitude,
      address: values.address,
      source: 'manual',
    };
  }

  return mutation as InventoryMutationDto;
};
