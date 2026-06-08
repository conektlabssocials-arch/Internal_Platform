import {
  documentShell,
  escapeHtml,
  formatCurrencyINR,
  formatDate,
  formatDateRange,
  formatLocation,
  formatSize,
  type TemplateOperationData,
  type TemplateOperationItem,
} from './template.utils.js';

const supplierLabel = (item: TemplateOperationItem) =>
  item.supplierName || item.ownerName || 'Supplier Not Assigned';

export const buildPurchaseOrderHtml = (data: TemplateOperationData) => {
  const groups = data.items.reduce<Record<string, TemplateOperationItem[]>>((acc, item) => {
    const key = supplierLabel(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
  const hasMissingCost = data.items.some((item) => !item.totalInternalCost);
  const totalCost = data.items.reduce((sum, item) => sum + (item.totalInternalCost || 0), 0);

  const body = `
    <section class="meta">
      <div><div class="label">PO Number</div><div class="value">${escapeHtml(data.poNumber)}</div></div>
      <div><div class="label">Operation</div><div class="value">${escapeHtml(data.operationCode)}</div></div>
      <div><div class="label">Campaign</div><div class="value">${escapeHtml(data.campaignCode)} · ${escapeHtml(data.campaignTitle)}</div></div>
      <div><div class="label">Plan Version</div><div class="value">${escapeHtml(data.planVersionLabel)}</div></div>
    </section>
    <section class="meta">
      <div><div class="label">Client</div><div class="value">${escapeHtml(data.clientName)}</div></div>
      <div><div class="label">Generated</div><div class="value">${escapeHtml(formatDate(data.generatedAt))}</div></div>
    </section>
    ${hasMissingCost ? '<p class="note">Cost not available for some items.</p>' : ''}

    ${Object.entries(groups)
      .map(
        ([supplierName, items]) => `
          <h2>Supplier: ${escapeHtml(supplierName)}</h2>
          <table>
            <thead>
              <tr>
                <th>Inventory</th>
                <th>Category</th>
                <th>City / Area</th>
                <th>Location / Route</th>
                <th>Dates</th>
                <th class="number">Agreed Cost</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                    <tr>
                      <td><strong>${escapeHtml(item.inventoryCode)}</strong><br>${escapeHtml(item.title)}<br><span class="muted">${escapeHtml(formatSize(item as any))}</span></td>
                      <td>${escapeHtml(item.categoryGroup)}<br><span class="muted">${escapeHtml(item.subCategory)}</span></td>
                      <td>${escapeHtml(item.city)} / ${escapeHtml(item.area)}</td>
                      <td>${escapeHtml(formatLocation(item))}</td>
                      <td>${escapeHtml(formatDateRange(item.campaignStartDate, item.campaignEndDate))}</td>
                      <td class="number">${escapeHtml(formatCurrencyINR(item.totalInternalCost || item.unitInternalCost || 0))}</td>
                      <td>${escapeHtml(item.purchaseOrder?.notes || item.notes || '-')}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        `,
      )
      .join('')}

    <table class="summary">
      <tr class="total"><td>Total Supplier Cost</td><td class="number">${escapeHtml(formatCurrencyINR(totalCost))}</td></tr>
    </table>

    <div class="terms">
      Payment terms: As per agreed commercial terms between Conekt Ads and the supplier/vendor. This purchase order confirms booking for the listed campaign dates and inventory placements.
    </div>
  `;

  return documentShell({
    title: 'Purchase Order',
    subtitle: 'Supplier-facing document confirming inventory booking and agreed cost.',
    generatedAt: data.generatedAt,
    body,
  });
};
