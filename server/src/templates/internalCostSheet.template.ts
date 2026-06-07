import {
  documentShell,
  escapeHtml,
  formatCurrencyINR,
} from './template.utils.js';
import type { TemplatePlanData } from './template.utils.js';

export const buildInternalCostSheetHtml = (data: TemplatePlanData) => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.inventoryCode)}</td>
        <td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.categoryGroup)}</span></td>
        <td>${escapeHtml(item.city)} / ${escapeHtml(item.area)}</td>
        <td class="number">${escapeHtml(formatCurrencyINR(item.totalSellingPrice))}</td>
        <td class="number">${escapeHtml(formatCurrencyINR(item.totalInternalCost))}</td>
        <td class="number">${escapeHtml(formatCurrencyINR(item.marginAmount))}</td>
        <td class="number">${item.marginPercentage.toFixed(2)}%</td>
      </tr>`,
    )
    .join('');

  return documentShell({
    title: 'Internal Cost Sheet',
    subtitle: 'Internal use only · Contains cost and margin information',
    generatedAt: data.generatedAt,
    body: `
      <div class="meta">
        <div><div class="label">Campaign</div><div class="value">${escapeHtml(data.campaignCode)}</div></div>
        <div><div class="label">Client</div><div class="value">${escapeHtml(data.clientName)}</div></div>
        <div><div class="label">Plan Version</div><div class="value">${escapeHtml(data.planVersionLabel)}</div></div>
      </div>
      <h2>Cost and Margin Detail</h2>
      <table>
        <thead><tr><th>Code</th><th>Inventory</th><th>Location</th><th class="number">Selling</th><th class="number">Internal Cost</th><th class="number">Margin</th><th class="number">Margin %</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">No inventory items.</td></tr>'}</tbody>
      </table>
      <table class="summary">
        <tr><td>Subtotal</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.subtotal))}</td></tr>
        <tr><td>Internal Cost</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.internalCostTotal))}</td></tr>
        <tr><td>Margin</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.marginAmount))}</td></tr>
        <tr><td>Margin %</td><td class="number">${data.pricing.marginPercentage.toFixed(2)}%</td></tr>
        <tr><td>Tax</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.taxAmount))}</td></tr>
        <tr class="total"><td>Grand Total</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.grandTotal))}</td></tr>
      </table>
      <h2>Internal Notes</h2>
      <div class="note">${escapeHtml(data.internalNotes || 'No internal notes.')}</div>
    `,
  });
};
