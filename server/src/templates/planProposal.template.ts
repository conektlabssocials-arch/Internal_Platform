import {
  documentShell,
  escapeHtml,
  formatCoordinate,
  formatCurrencyINR,
  formatDate,
  formatShortAddress,
  formatSize,
} from './template.utils.js';
import type { TemplatePlanData } from './template.utils.js';

export const buildPlanProposalHtml = (data: TemplatePlanData) => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.notes)}</span></td>
        <td>${escapeHtml(item.categoryGroup)}<br><span class="muted">${escapeHtml(item.subCategory)}</span></td>
        <td>${escapeHtml(item.city)} / ${escapeHtml(item.area)}</td>
        <td>${escapeHtml(formatSize(item))}</td>
        <td>${escapeHtml(item.illumination || '-')}</td>
        <td>${escapeHtml(formatDate(item.startDate))}<br>${escapeHtml(formatDate(item.endDate))}</td>
        <td class="number">${item.quantity}</td>
        <td class="number">${escapeHtml(formatCurrencyINR(item.totalSellingPrice))}</td>
      </tr>`,
    )
    .join('');
  const outdoorLocationRows = data.items
    // TODO: Add a static map image later through Mapbox Static Images or Google Static Maps.
    .filter(
      (item) =>
        ['Outdoor', 'A3 Screens'].includes(item.categoryGroup || '') &&
        Number.isFinite(item.location?.latitude) &&
        Number.isFinite(item.location?.longitude),
    )
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.inventoryCode)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.subCategory)}</td>
        <td>${escapeHtml(item.city)}</td>
        <td>${escapeHtml(item.area)}</td>
        <td>${escapeHtml(formatShortAddress(item.location?.address))}</td>
        <td class="number">${escapeHtml(formatCoordinate(item.location?.latitude))}</td>
        <td class="number">${escapeHtml(formatCoordinate(item.location?.longitude))}</td>
      </tr>`,
    )
    .join('');

  return documentShell({
    title: data.campaignTitle,
    subtitle: 'Media Plan Proposal',
    generatedAt: data.generatedAt,
    landscape: true,
    body: `
      <div class="meta">
        <div><div class="label">Client</div><div class="value">${escapeHtml(data.clientName)}</div></div>
        <div><div class="label">Campaign</div><div class="value">${escapeHtml(data.campaignCode)}</div></div>
        <div><div class="label">Plan Version</div><div class="value">${escapeHtml(data.planVersionLabel)}</div></div>
      </div>
      <h2>Campaign Brief</h2>
      <p>${escapeHtml(data.campaignBrief || '-')}</p>
      <h2>Selected Media</h2>
      <table>
        <thead><tr><th>Inventory</th><th>Category</th><th>Location</th><th>Size</th><th>Illumination</th><th>Dates</th><th class="number">Qty</th><th class="number">Selling Price</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8">No inventory items.</td></tr>'}</tbody>
      </table>
      <table class="summary">
        <tr><td>Subtotal</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.subtotal))}</td></tr>
        <tr><td>Tax (${data.pricing.taxPercentage}%)</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.taxAmount))}</td></tr>
        <tr class="total"><td>Grand Total</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.grandTotal))}</td></tr>
      </table>
      ${
        outdoorLocationRows
          ? `<h2>Fixed Site Locations</h2>
            <table>
              <thead><tr><th>Code</th><th>Title</th><th>Subcategory</th><th>City</th><th>Area</th><th>Address</th><th>Latitude</th><th>Longitude</th></tr></thead>
              <tbody>${outdoorLocationRows}</tbody>
            </table>
            <p class="terms">Interactive map view is available in the shared plan link.</p>`
          : ''
      }
      <h2>Client Notes</h2>
      <div class="note">${escapeHtml(data.clientNotes || 'No additional notes.')}</div>
      <div class="terms"><strong>Validity and Terms</strong><br>This proposal is subject to media availability and final confirmation. Commercial validity and detailed terms will be confirmed before execution.</div>
    `,
  });
};
