import ExcelJS from 'exceljs';

import { formatDate, formatSize } from './template.utils.js';
import type { TemplatePlanData } from './template.utils.js';

type PlanItem = TemplatePlanData['items'][number];

const HEADER_FILL = 'FF145C43';
const LINK_COLOR = 'FF1155CC';

const durationDays = (item: PlanItem) => {
  if (!item.startDate || !item.endDate) return 1;
  const start = new Date(item.startDate).getTime();
  const end = new Date(item.endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.ceil((end - start) / 86_400_000) + 1);
};

const mediaLabel = (item: PlanItem) =>
  [item.categoryGroup, item.subCategory].filter(Boolean).join(' · ') || 'Media';

const itemLocation = (item: PlanItem) =>
  item.location?.address ||
  [item.area, item.city].filter(Boolean).join(', ') ||
  '-';

// Google Maps link from coordinates when available, otherwise an address search.
const mapsLink = (item: PlanItem) => {
  const { latitude, longitude, address } = item.location || {};
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return undefined;
};

const getCampaignDates = (items: PlanItem[]) => {
  const starts = items
    .map((item) => item.startDate && new Date(item.startDate))
    .filter((value): value is Date => Boolean(value && !Number.isNaN(value.getTime())));
  const ends = items
    .map((item) => item.endDate && new Date(item.endDate))
    .filter((value): value is Date => Boolean(value && !Number.isNaN(value.getTime())));
  return {
    start: starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : undefined,
    end: ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : undefined,
  };
};

const buildMediaSummary = (items: PlanItem[]) => {
  const summary = new Map<string, { label: string; units: number; squareFeet: number; duration: number }>();
  for (const item of items) {
    const label = mediaLabel(item);
    const current = summary.get(label) || { label, units: 0, squareFeet: 0, duration: 0 };
    const quantity = item.quantity || 1;
    current.units += quantity;
    current.squareFeet += (item.totalSqFt || 0) * quantity;
    current.duration = Math.max(current.duration, durationDays(item));
    summary.set(label, current);
  }
  return [...summary.values()];
};

// Excel sheet names: max 31 chars, may not contain \ / ? * [ ] :, and must be
// unique within the workbook.
const sheetName = (raw: string, used: Set<string>) => {
  const base =
    (raw || 'Unspecified').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Unspecified';
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const styleHeaderRow = (row: ExcelJS.Row) => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: 'middle' };
};

const setLink = (cell: ExcelJS.Cell, text: string, url: string) => {
  cell.value = { text, hyperlink: url };
  cell.font = { color: { argb: LINK_COLOR }, underline: true };
};

// Overview sheet: plan-level information only (no per-item table — those live on
// the per-city sheets).
const buildSummarySheet = (workbook: ExcelJS.Workbook, data: TemplatePlanData) => {
  const ws = workbook.addWorksheet('Summary');
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 48;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;

  const cities = [...new Set(data.items.map((item) => item.city?.trim()).filter(Boolean))].sort(
    (a, b) => (a || '').localeCompare(b || ''),
  );
  const dates = getCampaignDates(data.items);
  const totalUnits = data.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalSquareFeet = data.items.reduce(
    (sum, item) => sum + (item.totalSqFt || 0) * (item.quantity || 1),
    0,
  );

  const title = ws.addRow(['PLAN OVERVIEW']);
  ws.mergeCells(title.number, 1, title.number, 4);
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  ws.addRow([]);

  const kv = (label: string, value: string | number) => {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    return row;
  };
  kv('Campaign', data.campaignTitle);
  kv('Prepared For', data.clientName);
  kv('Campaign ID', data.campaignCode);
  kv('Plan Version', data.planVersionLabel);
  kv('Selected Sites', data.items.length);
  kv('Cities', cities.join(', ') || '-');
  kv('Start Date', formatDate(dates.start));
  kv('End Date', formatDate(dates.end));
  kv('Total Units', totalUnits);
  kv('Total Sq Ft', totalSquareFeet);

  ws.addRow([]);
  const briefLabel = ws.addRow(['Campaign Brief']);
  briefLabel.getCell(1).font = { bold: true };
  const briefRow = ws.addRow([data.campaignBrief || 'Campaign brief not provided.']);
  ws.mergeCells(briefRow.number, 1, briefRow.number, 4);
  briefRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };

  ws.addRow([]);
  const sectionRow = ws.addRow(['Plan Summary by Media Type']);
  sectionRow.getCell(1).font = { bold: true };
  const mediaHeader = ws.addRow(['Media Type', 'Units', 'Total Sq Ft', 'Duration (days)']);
  styleHeaderRow(mediaHeader);
  for (const media of buildMediaSummary(data.items)) {
    ws.addRow([media.label, media.units, media.squareFeet, media.duration]);
  }

  ws.views = [{ state: 'frozen', ySplit: 2 }];
};

// One sheet per city: the detailed item table, with a Google Maps location link
// and a column per photo so every Drive photo is reachable.
const buildCitySheet = (workbook: ExcelJS.Workbook, name: string, items: PlanItem[]) => {
  const ws = workbook.addWorksheet(name);

  const photoLists = items.map((item) => (item.photos || []).filter(Boolean));
  const maxPhotos = Math.max(0, ...photoLists.map((list) => list.length));

  const baseHeaders = [
    'Code',
    'Title',
    'Category',
    'Sub Category',
    'Area',
    'Location',
    'Map Link',
    'Size',
    'Start',
    'End',
    'Duration (days)',
    'Qty',
    'Rate',
    'Total Cost',
    'Notes',
    'Photos',
  ];
  const photoHeaders = Array.from({ length: maxPhotos }, (_, i) => `Photo ${i + 1}`);
  const headerRow = ws.addRow([...baseHeaders, ...photoHeaders]);

  const baseWidths = [16, 30, 14, 14, 16, 28, 12, 14, 13, 13, 14, 8, 14, 16, 30, 8];
  baseWidths.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });
  photoHeaders.forEach((_, index) => {
    ws.getColumn(baseHeaders.length + 1 + index).width = 12;
  });

  const MAP_COL = 7;
  const RATE_COL = 13;
  const TOTAL_COL = 14;
  const PHOTO_START_COL = baseHeaders.length + 1;

  items.forEach((item, rowIndex) => {
    const photos = photoLists[rowIndex];
    const row = ws.addRow([
      item.inventoryCode || '',
      item.title,
      item.categoryGroup || '',
      item.subCategory || '',
      item.area || '',
      itemLocation(item),
      '',
      formatSize(item),
      formatDate(item.startDate),
      formatDate(item.endDate),
      durationDays(item),
      item.quantity || 1,
      item.unitSellingPrice || 0,
      item.totalSellingPrice || 0,
      item.notes || '',
      photos.length,
    ]);

    const mapUrl = mapsLink(item);
    if (mapUrl) setLink(row.getCell(MAP_COL), 'View Map', mapUrl);

    photos.forEach((url, index) => {
      setLink(row.getCell(PHOTO_START_COL + index), `Photo ${index + 1}`, url);
    });
  });

  ws.getColumn(RATE_COL).numFmt = '#,##0';
  ws.getColumn(TOTAL_COL).numFmt = '#,##0';
  styleHeaderRow(headerRow);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
};

export const buildPlanDataSheetWorkbook = async (
  data: TemplatePlanData,
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Conekt Ads';
  workbook.created = data.generatedAt;

  buildSummarySheet(workbook, data);

  // Group items by city, each city on its own sheet (sorted alphabetically).
  const groups = new Map<string, PlanItem[]>();
  for (const item of data.items) {
    const city = item.city?.trim() || 'Unspecified';
    const bucket = groups.get(city);
    if (bucket) bucket.push(item);
    else groups.set(city, [item]);
  }

  const used = new Set<string>(['summary']);
  const cities = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  for (const city of cities) {
    buildCitySheet(workbook, sheetName(city, used), groups.get(city) || []);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
};
