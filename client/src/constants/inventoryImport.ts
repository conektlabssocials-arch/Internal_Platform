import type { CategoryGroup } from '../types/inventory';

export type ImportFieldRequirement = 'required' | 'conditional' | 'optional';

export type ImportColumn = {
  name: string;
  requirement: ImportFieldRequirement;
  example: string;
};

export type ImportFieldRow = {
  name: string;
  label: string;
  requirement: ImportFieldRequirement;
  valueHint: string;
  example: string;
};

export const IMPORT_CATEGORY_GROUPS: CategoryGroup[] = ['Outdoor', 'Auto', 'Bus', 'Mobile Van'];

export const IMPORT_SUBCATEGORIES: Record<CategoryGroup, string[]> = {
  Outdoor: ['Bus Shelter', 'Hoarding', 'Digital OOH', 'Digital Bus Shelter'],
  Auto: ['Auto Hood', 'Auto Back Panel'],
  Bus: ['Bus Panel', 'Combo Panel', 'Full Bus Interior', 'Full Bus Exterior'],
  'Mobile Van': ['Hoarding', 'Van LED Screen', '3D Digital Screen'],
};

// Extra rule beyond the always-required fields, shown as an amber callout.
export const IMPORT_CONDITIONAL_NOTE: Record<CategoryGroup, string | null> = {
  Outdoor: null,
  Auto: 'Provide at least one of: numberOfVehicles or route.',
  Bus: 'Provide at least one of: route or depot.',
  'Mobile Van': null,
};

type FieldMeta = { label: string; valueHint: string };

const FIELD_META: Record<string, FieldMeta> = {
  categoryGroup: { label: 'Category Group', valueHint: 'Outdoor | Auto | Bus | Mobile Van' },
  subCategory: { label: 'Sub Category', valueHint: 'Must match the category group' },
  title: { label: 'Title', valueHint: 'Text' },
  city: { label: 'City', valueHint: 'Text' },
  area: { label: 'Area', valueHint: 'Text' },
  width: { label: 'Width', valueHint: 'Number (ft)' },
  height: { label: 'Height', valueHint: 'Number (ft)' },
  latitude: { label: 'Latitude', valueHint: 'Number (decimal degrees)' },
  longitude: { label: 'Longitude', valueHint: 'Number (decimal degrees)' },
  address: { label: 'Address', valueHint: 'Text' },
  internalCost: { label: 'Internal Cost', valueHint: 'Number' },
  sellingPrice: { label: 'Selling Price', valueHint: 'Number' },
  minSpend: { label: 'Min Spend', valueHint: 'Number' },
  minDurationDays: { label: 'Min Duration Days', valueHint: 'Number' },
  availabilityStatus: {
    label: 'Availability',
    valueHint: 'available | booked | hold | unknown (default unknown)',
  },
  status: { label: 'Status', valueHint: 'active | inactive (default active)' },
  ownerName: { label: 'Owner Name', valueHint: 'Text' },
  ownerPhone: { label: 'Owner Phone', valueHint: 'Text' },
  supplierName: { label: 'Supplier Name', valueHint: 'Text' },
  photos: { label: 'Photos', valueHint: 'Image URLs separated by |' },
  tags: { label: 'Tags', valueHint: 'Values separated by |' },
  internalNotes: { label: 'Internal Notes', valueHint: 'Text' },
  illumination: { label: 'Illumination', valueHint: 'Lit | Non-lit | Backlit | Frontlit | NA' },
  facingDirection: { label: 'Facing Direction', valueHint: 'Text' },
  trafficDirection: { label: 'Traffic Direction', valueHint: 'Text' },
  estimatedTraffic: { label: 'Estimated Traffic', valueHint: 'Text' },
  loopLengthSeconds: { label: 'Loop Length (seconds)', valueHint: 'Number' },
  spotsPerHour: { label: 'Spots Per Hour', valueHint: 'Number' },
  screenSpecs: { label: 'Screen Specs', valueHint: 'Text' },
  numberOfVehicles: { label: 'Number Of Vehicles', valueHint: 'Number' },
  route: { label: 'Route', valueHint: 'Text' },
  depot: { label: 'Depot', valueHint: 'Text' },
  brandingType: { label: 'Branding Type', valueHint: 'Text' },
  ratePerVehiclePerMonth: { label: 'Rate Per Vehicle / Month', valueHint: 'Number' },
  operatorName: { label: 'Operator Name', valueHint: 'Text' },
  itinerary: { label: 'Itinerary', valueHint: 'Text' },
  operationDays: { label: 'Operation Days', valueHint: 'Number' },
  hasLedScreen: { label: 'Has LED Screen', valueHint: 'true | false' },
  hasAudioSystem: { label: 'Has Audio System', valueHint: 'true | false' },
  hasCanopy: { label: 'Has Canopy', valueHint: 'true | false' },
  ratePerDay: { label: 'Rate Per Day', valueHint: 'Number' },
};

// Common optional columns shared by every category, in template order.
const commonOptional: ImportColumn[] = [
  { name: 'internalCost', requirement: 'optional', example: '' },
  { name: 'sellingPrice', requirement: 'optional', example: '' },
  { name: 'minSpend', requirement: 'optional', example: '' },
  { name: 'minDurationDays', requirement: 'optional', example: '' },
  { name: 'availabilityStatus', requirement: 'optional', example: 'available' },
  { name: 'status', requirement: 'optional', example: 'active' },
  { name: 'ownerName', requirement: 'optional', example: '' },
  { name: 'ownerPhone', requirement: 'optional', example: '' },
  { name: 'supplierName', requirement: 'optional', example: '' },
  { name: 'photos', requirement: 'optional', example: 'https://example.com/a.jpg|https://example.com/b.jpg' },
  { name: 'tags', requirement: 'optional', example: 'premium|highway' },
  { name: 'internalNotes', requirement: 'optional', example: '' },
];

const coreRequired = (
  group: CategoryGroup,
  values: { subCategory: string; title: string; city: string; area: string; width: string; height: string },
): ImportColumn[] => [
  { name: 'categoryGroup', requirement: 'required', example: group },
  { name: 'subCategory', requirement: 'required', example: values.subCategory },
  { name: 'title', requirement: 'required', example: values.title },
  { name: 'city', requirement: 'required', example: values.city },
  { name: 'area', requirement: 'required', example: values.area },
  { name: 'width', requirement: 'required', example: values.width },
  { name: 'height', requirement: 'required', example: values.height },
];

// Ordered columns per category: core required -> category required -> common optional -> category extras.
export const IMPORT_CATEGORY_COLUMNS: Record<CategoryGroup, ImportColumn[]> = {
  Outdoor: [
    ...coreRequired('Outdoor', {
      subCategory: 'Hoarding',
      title: 'MG Road Hoarding',
      city: 'Bengaluru',
      area: 'MG Road',
      width: '40',
      height: '20',
    }),
    { name: 'latitude', requirement: 'required', example: '12.9716' },
    { name: 'longitude', requirement: 'required', example: '77.5946' },
    { name: 'address', requirement: 'required', example: '100 MG Road, Bengaluru' },
    ...commonOptional,
    { name: 'illumination', requirement: 'optional', example: 'Lit' },
    { name: 'facingDirection', requirement: 'optional', example: 'North' },
    { name: 'trafficDirection', requirement: 'optional', example: 'North to South' },
    { name: 'estimatedTraffic', requirement: 'optional', example: 'High' },
    { name: 'loopLengthSeconds', requirement: 'optional', example: '' },
    { name: 'spotsPerHour', requirement: 'optional', example: '' },
    { name: 'screenSpecs', requirement: 'optional', example: '' },
  ],
  Auto: [
    ...coreRequired('Auto', {
      subCategory: 'Auto Hood',
      title: 'Auto Hood Branding - Indiranagar',
      city: 'Bengaluru',
      area: 'Indiranagar',
      width: '4',
      height: '3',
    }),
    ...commonOptional,
    { name: 'numberOfVehicles', requirement: 'conditional', example: '50' },
    { name: 'route', requirement: 'conditional', example: 'Indiranagar - Koramangala' },
    { name: 'brandingType', requirement: 'optional', example: 'Full Hood' },
    { name: 'ratePerVehiclePerMonth', requirement: 'optional', example: '1200' },
    { name: 'operatorName', requirement: 'optional', example: 'City Autos' },
  ],
  Bus: [
    ...coreRequired('Bus', {
      subCategory: 'Bus Panel',
      title: 'Bus Side Panel - Route 500',
      city: 'Bengaluru',
      area: 'Whitefield',
      width: '10',
      height: '4',
    }),
    ...commonOptional,
    { name: 'numberOfVehicles', requirement: 'optional', example: '20' },
    { name: 'route', requirement: 'conditional', example: 'Route 500D' },
    { name: 'depot', requirement: 'conditional', example: 'Whitefield Depot' },
    { name: 'brandingType', requirement: 'optional', example: 'Side Panel' },
    { name: 'ratePerVehiclePerMonth', requirement: 'optional', example: '5000' },
    { name: 'operatorName', requirement: 'optional', example: 'BMTC' },
  ],
  'Mobile Van': [
    ...coreRequired('Mobile Van', {
      subCategory: 'Van LED Screen',
      title: 'LED Van - City Circuit',
      city: 'Bengaluru',
      area: 'City Wide',
      width: '12',
      height: '8',
    }),
    { name: 'itinerary', requirement: 'required', example: 'MG Road -> Brigade Road -> Koramangala' },
    ...commonOptional,
    { name: 'operationDays', requirement: 'optional', example: '26' },
    { name: 'hasLedScreen', requirement: 'optional', example: 'true' },
    { name: 'hasAudioSystem', requirement: 'optional', example: 'true' },
    { name: 'hasCanopy', requirement: 'optional', example: 'false' },
    { name: 'ratePerDay', requirement: 'optional', example: '8000' },
  ],
};

export const getImportFieldRows = (group: CategoryGroup): ImportFieldRow[] =>
  IMPORT_CATEGORY_COLUMNS[group].map((column) => {
    const meta = FIELD_META[column.name] ?? { label: column.name, valueHint: 'Text' };
    const valueHint =
      column.name === 'subCategory' ? IMPORT_SUBCATEGORIES[group].join(' | ') : meta.valueHint;

    return {
      name: column.name,
      label: meta.label,
      requirement: column.requirement,
      valueHint,
      example: column.example,
    };
  });

const escapeCsvValue = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const triggerCsvDownload = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadCategoryTemplate = (group: CategoryGroup) => {
  const columns = IMPORT_CATEGORY_COLUMNS[group];
  const header = columns.map((column) => column.name).join(',');
  const example = columns.map((column) => escapeCsvValue(column.example)).join(',');
  const slug = group.toLowerCase().replace(/\s+/g, '-');

  triggerCsvDownload(`inventory-import-${slug}.csv`, `${header}\n${example}\n`);
};

export const downloadCombinedTemplate = () => {
  // Union of all columns in canonical order, with one example row per category.
  const seen = new Set<string>();
  const columns: string[] = [];

  for (const group of IMPORT_CATEGORY_GROUPS) {
    for (const column of IMPORT_CATEGORY_COLUMNS[group]) {
      if (!seen.has(column.name)) {
        seen.add(column.name);
        columns.push(column.name);
      }
    }
  }

  const header = columns.join(',');
  const rows = IMPORT_CATEGORY_GROUPS.map((group) => {
    const exampleByName = new Map(
      IMPORT_CATEGORY_COLUMNS[group].map((column) => [column.name, column.example]),
    );

    return columns.map((name) => escapeCsvValue(exampleByName.get(name) ?? '')).join(',');
  });

  triggerCsvDownload('inventory-import-all-categories.csv', [header, ...rows].join('\n') + '\n');
};
