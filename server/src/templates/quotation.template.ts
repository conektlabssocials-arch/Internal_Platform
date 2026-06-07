import {
  documentShell,
  escapeHtml,
  formatCurrencyINR,
} from './template.utils.js';
import type { TemplatePlanData } from './template.utils.js';

export const buildQuotationHtml = (data: TemplatePlanData) => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.city)} / ${escapeHtml(item.area)}</span></td>
        <td class="number">${item.quantity}</td>
        <td class="number">${escapeHtml(formatCurrencyINR(item.unitSellingPrice))}</td>
        <td class="number">${escapeHtml(formatCurrencyINR(item.totalSellingPrice))}</td>
      </tr>`,
    )
    .join('');

  return documentShell({
    title: 'Quotation',
    subtitle: `${data.campaignCode} · ${data.planVersionLabel}`,
    generatedAt: data.generatedAt,
    body: `
      <div class="meta">
        <div><div class="label">Quotation Reference</div><div class="value">${escapeHtml(data.documentId || 'Generated quotation')}</div></div>
        <div><div class="label">Client</div><div class="value">${escapeHtml(data.clientName)}</div></div>
        <div><div class="label">Campaign</div><div class="value">${escapeHtml(data.campaignTitle)}</div></div>
      </div>
      <h2>Commercial Details</h2>
      <table>
        <thead><tr><th>Description</th><th class="number">Quantity</th><th class="number">Rate</th><th class="number">Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">No line items.</td></tr>'}</tbody>
      </table>
      <table class="summary">
        <tr><td>Subtotal</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.subtotal))}</td></tr>
        <tr><td>Tax (${data.pricing.taxPercentage}%)</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.taxAmount))}</td></tr>
        <tr class="total"><td>Grand Total</td><td class="number">${escapeHtml(formatCurrencyINR(data.pricing.grandTotal))}</td></tr>
      </table>
      <div class="terms"><strong>Payment Terms</strong><br>Payment schedule will be confirmed in the final commercial agreement.<br><br><strong>Terms and Conditions</strong><br>Rates are subject to inventory availability, applicable taxes, and written campaign confirmation.</div>
    `,
  });
};
