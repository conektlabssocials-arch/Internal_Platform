export type TemplatePlanData = {
  documentId?: string;
  generatedAt: Date;
  campaignCode: string;
  campaignTitle: string;
  campaignBrief?: string;
  clientName: string;
  planVersionLabel: string;
  clientNotes?: string;
  internalNotes?: string;
  items: Array<{
    inventoryCode?: string;
    title: string;
    categoryGroup?: string;
    subCategory?: string;
    city?: string;
    area?: string;
    width?: number;
    height?: number;
    totalSqFt?: number;
    location?: {
      address?: string;
      latitude?: number;
      longitude?: number;
    };
    photos?: string[];
    route?: string;
    depot?: string;
    itinerary?: string;
    startDate?: Date;
    endDate?: Date;
    quantity: number;
    unitSellingPrice: number;
    totalSellingPrice: number;
    unitInternalCost: number;
    totalInternalCost: number;
    marginAmount: number;
    marginPercentage: number;
    notes?: string;
  }>;
  pricing: {
    subtotal: number;
    taxPercentage: number;
    taxAmount: number;
    grandTotal: number;
    internalCostTotal: number;
    marginAmount: number;
    marginPercentage: number;
  };
};

export type TemplateOperationItem = {
  inventoryCode?: string;
  title?: string;
  categoryGroup?: string;
  subCategory?: string;
  city?: string;
  area?: string;
  width?: number;
  height?: number;
  totalSqFt?: number;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  route?: string;
  depot?: string;
  itinerary?: string;
  campaignStartDate?: Date;
  campaignEndDate?: Date;
  unitSellingPrice?: number;
  totalSellingPrice?: number;
  unitInternalCost?: number;
  totalInternalCost?: number;
  supplierName?: string;
  ownerName?: string;
  creative?: {
    required?: boolean;
    received?: boolean;
    receivedAt?: Date;
    notes?: string;
  };
  purchaseOrder?: {
    required?: boolean;
    sent?: boolean;
    sentAt?: Date;
    poNumber?: string;
    notes?: string;
  };
  mounting?: {
    scheduledDate?: Date;
    completed?: boolean;
    completedAt?: Date;
    vendorNotes?: string;
    internalNotes?: string;
  };
  proof?: {
    uploaded?: boolean;
    uploadedAt?: Date;
    photoUrls?: string[];
    notes?: string;
  };
  takedown?: {
    required?: boolean;
    scheduledDate?: Date;
    completed?: boolean;
    completedAt?: Date;
    notes?: string;
  };
  itemStatus?: string;
  notes?: string;
};

export type TemplateOperationData = {
  generatedAt: Date;
  operationCode: string;
  campaignCode?: string;
  campaignTitle?: string;
  clientName?: string;
  planVersionLabel?: string;
  operationStatus?: string;
  operationOwnerName?: string;
  notes?: string;
  poNumber?: string;
  partial?: boolean;
  proofUploadedCount: number;
  totalItems: number;
  mountedCount: number;
  items: TemplateOperationItem[];
};

export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const formatCurrencyINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

export const formatDate = (value?: Date) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(value)
    : '-';

export const formatSize = (item: TemplatePlanData['items'][number]) => {
  if (item.width && item.height) return `${item.width} x ${item.height} ft`;
  if (item.totalSqFt) return `${item.totalSqFt} sq ft`;
  return '-';
};

export const formatBoolean = (value?: boolean) => (value ? 'Yes' : 'No');

export const formatDateRange = (start?: Date, end?: Date) =>
  `${formatDate(start)} - ${formatDate(end)}`;

export const formatLocation = (item: TemplateOperationItem) => {
  if (item.location?.address) return item.location.address;
  const parts = [item.route, item.depot, item.itinerary].filter(Boolean);
  return parts.length ? parts.join(' · ') : '-';
};

export const documentShell = ({
  title,
  subtitle,
  generatedAt,
  body,
}: {
  title: string;
  subtitle: string;
  generatedAt: Date;
  body: string;
}) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17211d; background: #fbfaf6; font: 12px Arial, sans-serif; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 6px; font-size: 26px; }
    h2 { margin: 24px 0 10px; color: #176b4d; font-size: 16px; }
    .brand { color: #176b4d; font-size: 18px; font-weight: 700; letter-spacing: .5px; }
    .header { border-bottom: 3px solid #3aa675; padding-bottom: 18px; }
    .subtitle, .muted { color: #66736d; }
    .meta { display: flex; justify-content: space-between; gap: 16px; margin-top: 18px; }
    .meta > div { min-width: 0; }
    .label { color: #66736d; font-size: 10px; text-transform: uppercase; }
    .value { margin-top: 3px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { padding: 8px 6px; background: #e6f3ec; color: #17573f; text-align: left; font-size: 10px; }
    td { padding: 8px 6px; border-bottom: 1px solid #dce5df; vertical-align: top; }
    tr { break-inside: avoid; }
    .number { text-align: right; white-space: nowrap; }
    .summary { width: 46%; margin: 18px 0 0 auto; }
    .summary td { padding: 6px; }
    .summary .total td { border-top: 2px solid #3aa675; font-size: 14px; font-weight: 700; }
    .note { padding: 12px; border-left: 3px solid #3aa675; background: #f0f6f2; white-space: pre-wrap; }
    .terms { margin-top: 24px; color: #66736d; font-size: 10px; line-height: 1.5; }
    .footer { margin-top: 28px; border-top: 1px solid #dce5df; padding-top: 10px; color: #66736d; font-size: 9px; }
    .badge { display: inline-block; border-radius: 999px; background: #e6f3ec; color: #176b4d; padding: 4px 8px; font-size: 10px; font-weight: 700; }
    .badge.warn { background: #fff4d6; color: #8a5800; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
    .card { border: 1px solid #dce5df; border-radius: 8px; background: #fff; padding: 10px; break-inside: avoid; }
    .proof-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px; }
    .proof-img { width: 100%; max-height: 160px; object-fit: cover; border: 1px solid #dce5df; border-radius: 6px; }
    .small { font-size: 10px; }
  </style>
</head>
<body>
  <header class="header">
    <div class="brand">CONEKT ADS</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${escapeHtml(subtitle)}</p>
  </header>
  ${body}
  <footer class="footer">Generated on ${escapeHtml(formatDate(generatedAt))} · Conekt Ads Internal Platform</footer>
</body>
</html>`;
