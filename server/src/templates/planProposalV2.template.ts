import {
  escapeHtml,
  formatCurrencyINR,
  formatDate,
  formatSize,
} from './template.utils.js';
import type { TemplatePlanData } from './template.utils.js';

type PlanItem = TemplatePlanData['items'][number];

const number = (value?: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0);

const noImageGraphic = `
  <svg viewBox="0 0 640 420" aria-label="No inventory image available">
    <rect width="640" height="420" fill="#eaf5ef"/>
    <rect x="120" y="72" width="400" height="248" rx="18" fill="#d6eadf" stroke="#8fc5a8" stroke-width="6"/>
    <circle cx="238" cy="156" r="34" fill="#68ad88"/>
    <path d="M155 286l105-104 72 68 54-48 99 84H155z" fill="#27805a"/>
    <text x="320" y="370" fill="#176b4d" font-family="Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle">NO IMAGE AVAILABLE</text>
  </svg>`;

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
  item.route ||
  item.depot ||
  item.itinerary ||
  '-';

const buildMediaSummary = (items: PlanItem[]) => {
  const summary = new Map<
    string,
    { label: string; units: number; squareFeet: number; duration: number }
  >();

  for (const item of items) {
    const label = mediaLabel(item);
    const current = summary.get(label) || {
      label,
      units: 0,
      squareFeet: 0,
      duration: 0,
    };
    const quantity = item.quantity || 1;
    current.units += quantity;
    current.squareFeet += (item.totalSqFt || 0) * quantity;
    current.duration = Math.max(current.duration, durationDays(item));
    summary.set(label, current);
  }

  return [...summary.values()];
};

const getCampaignDates = (items: PlanItem[]) => {
  const starts = items
    .map((item) => item.startDate && new Date(item.startDate))
    .filter((value): value is Date => Boolean(value && !Number.isNaN(value.getTime())));
  const ends = items
    .map((item) => item.endDate && new Date(item.endDate))
    .filter((value): value is Date => Boolean(value && !Number.isNaN(value.getTime())));

  return {
    start: starts.length
      ? new Date(Math.min(...starts.map((value) => value.getTime())))
      : undefined,
    end: ends.length
      ? new Date(Math.max(...ends.map((value) => value.getTime())))
      : undefined,
  };
};

const sitePage = (item: PlanItem, index: number) => {
  const photo = item.photos?.find(Boolean);
  const propertyMetrics =
    item.categoryGroup === 'A3 Screens'
      ? [
          ['Households / Flats', number(item.households)],
          ['Approx. Reach', number(item.approxReach)],
          ['Monthly Impressions', number(item.monthlyImpressions)],
          ['Building Age', item.buildingAge !== undefined ? `${number(item.buildingAge)} years` : '-'],
          ['Screen Size', item.screenSize || '-'],
          ['No. of Screens', number(item.numberOfScreens)],
        ]
      : [];
  const routeDetails = [
    item.route && `Route: ${item.route}`,
    item.depot && `Depot: ${item.depot}`,
    item.itinerary && `Itinerary: ${item.itinerary}`,
  ].filter(Boolean);

  return `
    <section class="page site-page">
      <div class="page-kicker">LOCATION ${String(index + 1).padStart(2, '0')}</div>
      <h2>${escapeHtml(item.title)}</h2>
      <div class="site-layout">
        <div class="photo-frame">
          ${
            photo
              ? `<div class="photo-empty">${noImageGraphic}</div>
                 <img src="${escapeHtml(photo)}" alt="${escapeHtml(item.title)}" onerror="this.style.display='none'" />`
              : `<div class="photo-empty">${noImageGraphic}</div>`
          }
        </div>
        <div class="site-details">
          <div class="site-code">${escapeHtml(item.inventoryCode || 'Inventory site')}</div>
          <dl>
            <div><dt>Media</dt><dd>${escapeHtml(mediaLabel(item))}</dd></div>
            <div><dt>City / Area</dt><dd>${escapeHtml([item.city, item.area].filter(Boolean).join(' / ') || '-')}</dd></div>
            <div><dt>Location</dt><dd>${escapeHtml(itemLocation(item))}</dd></div>
            <div><dt>Size</dt><dd>${escapeHtml(formatSize(item))}</dd></div>
            <div><dt>Units</dt><dd>${escapeHtml(item.quantity || 1)}</dd></div>
            <div><dt>Campaign Dates</dt><dd>${escapeHtml(formatDate(item.startDate))} - ${escapeHtml(formatDate(item.endDate))}</dd></div>
            <div><dt>Duration</dt><dd>${durationDays(item)} days</dd></div>
            <div><dt>Rate</dt><dd>${escapeHtml(formatCurrencyINR(item.unitSellingPrice))}</dd></div>
            <div class="total-row"><dt>Total Cost</dt><dd>${escapeHtml(formatCurrencyINR(item.totalSellingPrice))}</dd></div>
          </dl>
          ${
            routeDetails.length
              ? `<div class="route-details">${routeDetails.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>`
              : ''
          }
          ${
            propertyMetrics.length
              ? `<div class="property-metrics">
                  <h3>Property Audience</h3>
                  <div class="property-grid">
                    ${propertyMetrics
                      .map(
                        ([label, value]) =>
                          `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
                      )
                      .join('')}
                  </div>
                </div>`
              : ''
          }
          ${item.notes ? `<div class="site-note">${escapeHtml(item.notes)}</div>` : ''}
        </div>
      </div>
      <div class="page-footer"><span>CONEKT ADS</span><span>${escapeHtml(item.inventoryCode || '')}</span></div>
    </section>`;
};

export const buildPlanProposalV2Html = (data: TemplatePlanData) => {
  const dates = getCampaignDates(data.items);
  const cities = [...new Set(data.items.map((item) => item.city).filter(Boolean))];
  const mediaSummary = buildMediaSummary(data.items);
  const totalUnits = data.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalSquareFeet = data.items.reduce(
    (sum, item) => sum + (item.totalSqFt || 0) * (item.quantity || 1),
    0,
  );

  const summaryRows = mediaSummary
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.label)}</td>
        <td class="number">${row.units}</td>
        <td class="number">${number(row.squareFeet)}</td>
        <td class="number">${row.duration} days</td>
      </tr>`,
    )
    .join('');

  const inventoryRows = data.items
    .map(
      (item, index) => `<tr>
        <td>${String(index + 1).padStart(2, '0')}</td>
        <td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.inventoryCode || '')}</span></td>
        <td>${escapeHtml([item.area, item.city].filter(Boolean).join(', ') || '-')}</td>
        <td>${escapeHtml(formatSize(item))}</td>
        <td>${escapeHtml(mediaLabel(item))}</td>
        <td class="number">${durationDays(item)} days</td>
        <td class="number">${escapeHtml(formatCurrencyINR(item.totalSellingPrice))}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: #173229; background: #f7f8f3; font: 11px Arial, sans-serif; }
    h1, h2, h3, p { margin-top: 0; }
    .page { position: relative; width: 297mm; min-height: 210mm; padding: 16mm 18mm 14mm; page-break-after: always; overflow: hidden; background: #f7f8f3; }
    .page:last-child { page-break-after: auto; }
    .cover { display: flex; flex-direction: column; justify-content: space-between; color: #fff; background: #145c43; }
    .cover:after { content: ""; position: absolute; right: -35mm; bottom: -55mm; width: 155mm; height: 155mm; border: 25mm solid rgba(255,255,255,.07); border-radius: 50%; }
    .brand { position: relative; z-index: 1; font-size: 19px; font-weight: 800; letter-spacing: 2px; }
    .cover-main { position: relative; z-index: 1; max-width: 220mm; }
    .cover-city { margin-bottom: 5mm; color: #bfe7d0; font-size: 15px; font-weight: 700; text-transform: uppercase; }
    .cover h1 { max-width: 210mm; margin-bottom: 5mm; font-size: 37px; line-height: 1.04; letter-spacing: 0; }
    .cover-subtitle { font-size: 18px; color: #e7f5ed; }
    .cover-meta { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8mm; padding-top: 8mm; border-top: 1px solid rgba(255,255,255,.3); }
    .cover-meta span { display: block; margin-bottom: 2mm; color: #bfe7d0; font-size: 9px; text-transform: uppercase; }
    .cover-meta strong { font-size: 14px; }
    .page-kicker { margin-bottom: 3mm; color: #2b8a61; font-size: 10px; font-weight: 800; letter-spacing: 1.4px; }
    h2 { margin-bottom: 8mm; color: #173229; font-size: 25px; line-height: 1.1; }
    h3 { margin-bottom: 4mm; color: #145c43; font-size: 14px; }
    .overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .panel { padding: 7mm; border: 1px solid #d7e4dc; border-radius: 2mm; background: #fff; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm 8mm; }
    .label { margin-bottom: 1mm; color: #6b7d75; font-size: 9px; text-transform: uppercase; }
    .value { color: #173229; font-size: 13px; font-weight: 700; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .metric { padding: 5mm; border-left: 3px solid #39a272; background: #eaf5ef; }
    .metric strong { display: block; margin-top: 2mm; color: #145c43; font-size: 20px; }
    .brief { margin-top: 8mm; padding: 6mm; border-left: 3px solid #39a272; background: #edf5f0; line-height: 1.6; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th { padding: 3.5mm 3mm; color: #fff; background: #145c43; text-align: left; font-size: 9px; text-transform: uppercase; }
    td { padding: 3.5mm 3mm; border-bottom: 1px solid #dce6e0; vertical-align: top; }
    tbody tr:nth-child(even) { background: #f1f6f3; }
    .number { text-align: right; white-space: nowrap; }
    .muted { color: #708078; font-size: 9px; }
    .pricing { width: 82mm; margin: 8mm 0 0 auto; }
    .pricing td { padding: 2.5mm 3mm; }
    .pricing .grand td { border-top: 2px solid #39a272; color: #145c43; font-size: 13px; font-weight: 800; }
    .site-layout { display: grid; grid-template-columns: 1.6fr 1fr; gap: 9mm; height: 142mm; }
    .photo-frame { position: relative; min-width: 0; overflow: hidden; border: 1px solid #d3e1d9; border-radius: 2mm; background: #e5eee9; }
    .photo-frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .photo-empty { display: grid; width: 100%; height: 100%; place-items: center; color: #718078; background: #e9f0ec; }
    .photo-empty svg { width: 78%; max-height: 78%; }
    .site-details { min-width: 0; padding: 6mm; border: 1px solid #d7e4dc; border-radius: 2mm; background: #fff; }
    .site-code { margin-bottom: 4mm; color: #2b8a61; font-size: 10px; font-weight: 800; letter-spacing: .7px; }
    dl { margin: 0; }
    dl > div { display: grid; grid-template-columns: 40% 60%; padding: 2.3mm 0; border-bottom: 1px solid #e4ebe7; }
    dt { color: #708078; }
    dd { margin: 0; color: #173229; font-weight: 700; text-align: right; overflow-wrap: anywhere; }
    dl .total-row { margin-top: 2mm; padding-top: 3mm; border-top: 2px solid #39a272; border-bottom: 0; }
    dl .total-row dt, dl .total-row dd { color: #145c43; font-size: 13px; font-weight: 800; }
    .route-details, .site-note { margin-top: 4mm; padding: 3mm; color: #51665d; background: #edf5f0; font-size: 9px; line-height: 1.4; }
    .route-details p { margin-bottom: 1mm; }
    .site-note { white-space: pre-wrap; }
    .property-metrics { margin-top: 4mm; padding-top: 3mm; border-top: 1px solid #dce6e0; }
    .property-metrics h3 { margin-bottom: 2.5mm; font-size: 11px; }
    .property-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; }
    .property-grid div { padding: 2mm; background: #edf5f0; }
    .property-grid span { display: block; color: #708078; font-size: 7.5px; text-transform: uppercase; }
    .property-grid strong { display: block; margin-top: 1mm; color: #145c43; font-size: 10px; overflow-wrap: anywhere; }
    .client-note { margin-top: 7mm; padding: 5mm; border-left: 3px solid #39a272; background: #edf5f0; white-space: pre-wrap; }
    .terms { margin-top: 5mm; color: #708078; font-size: 9px; line-height: 1.5; }
    .page-footer { position: absolute; right: 18mm; bottom: 7mm; left: 18mm; display: flex; justify-content: space-between; padding-top: 2mm; border-top: 1px solid #d7e4dc; color: #73827b; font-size: 8px; letter-spacing: .5px; }
  </style>
</head>
<body>
  <section class="page cover">
    <div class="brand">CONEKT ADS</div>
    <div class="cover-main">
      <div class="cover-city">${escapeHtml(cities.join(' · ') || 'Media Plan')}</div>
      <h1>${escapeHtml(data.campaignTitle)}</h1>
      <p class="cover-subtitle">Media Plan Proposal V2</p>
    </div>
    <div class="cover-meta">
      <div><span>Prepared for</span><strong>${escapeHtml(data.clientName)}</strong></div>
      <div><span>Campaign</span><strong>${escapeHtml(data.campaignCode)}</strong></div>
      <div><span>Plan Version</span><strong>${escapeHtml(data.planVersionLabel)}</strong></div>
      <div><span>Selected Sites</span><strong>${data.items.length}</strong></div>
    </div>
  </section>

  <section class="page">
    <div class="page-kicker">MEDIA PLAN</div>
    <h2>Plan Overview</h2>
    <div class="overview-grid">
      <div class="panel">
        <h3>Campaign Information</h3>
        <div class="info-grid">
          <div><div class="label">Campaign</div><div class="value">${escapeHtml(data.campaignTitle)}</div></div>
          <div><div class="label">Client</div><div class="value">${escapeHtml(data.clientName)}</div></div>
          <div><div class="label">Start Date</div><div class="value">${escapeHtml(formatDate(dates.start))}</div></div>
          <div><div class="label">End Date</div><div class="value">${escapeHtml(formatDate(dates.end))}</div></div>
          <div><div class="label">City</div><div class="value">${escapeHtml(cities.join(', ') || '-')}</div></div>
          <div><div class="label">Plan Version</div><div class="value">${escapeHtml(data.planVersionLabel)}</div></div>
        </div>
      </div>
      <div class="panel">
        <h3>Plan Metrics</h3>
        <div class="metric-grid">
          <div class="metric"><span>Selected Sites</span><strong>${data.items.length}</strong></div>
          <div class="metric"><span>Total Units</span><strong>${totalUnits}</strong></div>
          <div class="metric"><span>Total Sq Ft</span><strong>${number(totalSquareFeet)}</strong></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top: 8mm">
      <h3>Plan Summary by Media Type</h3>
      <table>
        <thead><tr><th>Media Type</th><th class="number">Units</th><th class="number">Total Sq Ft</th><th class="number">Duration</th></tr></thead>
        <tbody>${summaryRows || '<tr><td colspan="4">No inventory items.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="brief"><strong>Campaign Brief</strong><br>${escapeHtml(data.campaignBrief || 'Campaign brief not provided.')}</div>
    <div class="page-footer"><span>CONEKT ADS</span><span>Plan Overview</span></div>
  </section>

  <section class="page">
    <div class="page-kicker">MEDIA PLAN</div>
    <h2>Site Inventory Summary</h2>
    <table>
      <thead><tr><th>#</th><th>Location / Inventory</th><th>Area / City</th><th>Size</th><th>Media Type</th><th class="number">Duration</th><th class="number">Total Cost</th></tr></thead>
      <tbody>${inventoryRows || '<tr><td colspan="7">No inventory items.</td></tr>'}</tbody>
    </table>
    <table class="pricing">
      <tr><td>Subtotal</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.subtotal))}</td></tr>
      <tr><td>Tax (${number(data.pricing.taxPercentage)}%)</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.taxAmount))}</td></tr>
      <tr class="grand"><td>Grand Total</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.grandTotal))}</td></tr>
    </table>
    ${data.clientNotes ? `<div class="client-note"><strong>Client Notes</strong><br>${escapeHtml(data.clientNotes)}</div>` : ''}
    <div class="terms">Rates are subject to media availability and final confirmation. Production, permissions, taxes, and other terms apply as stated in the final commercial agreement.</div>
    <div class="page-footer"><span>CONEKT ADS</span><span>Inventory Summary</span></div>
  </section>

  ${data.items.map(sitePage).join('')}
</body>
</html>`;
};
