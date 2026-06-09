import {
  documentShell,
  escapeHtml,
  formatDate,
  formatDateRange,
  formatLocation,
  formatSize,
  type TemplateOperationData,
} from './template.utils.js';

const proofLinks = (urls: string[] = []) =>
  urls.length
    ? `<div class="proof-grid">${urls
        .map(
          (url) => `
            <div>
              <img class="proof-img" src="${escapeHtml(url)}" />
              <div class="small muted">${escapeHtml(url)}</div>
            </div>
          `,
        )
        .join('')}</div>`
    : '<p class="muted">Proof pending.</p>';

export const buildExecutionReportHtml = (data: TemplateOperationData) => {
  const body = `
    <section class="meta">
      <div><div class="label">Campaign Code</div><div class="value">${escapeHtml(data.campaignCode)}</div></div>
      <div><div class="label">Campaign</div><div class="value">${escapeHtml(data.campaignTitle)}</div></div>
      <div><div class="label">Client</div><div class="value">${escapeHtml(data.clientName)}</div></div>
      <div><div class="label">Plan Version</div><div class="value">${escapeHtml(data.planVersionLabel)}</div></div>
    </section>
    <section class="meta">
      <div><div class="label">Report Status</div><div class="value">${data.partial ? '<span class="badge warn">Partial Execution Report</span>' : '<span class="badge">Complete Execution Report</span>'}</div></div>
      <div><div class="label">Total Items</div><div class="value">${data.totalItems}</div></div>
      <div><div class="label">Mounted / Deployed</div><div class="value">${data.mountedCount}/${data.totalItems}</div></div>
      <div><div class="label">Proof Uploaded</div><div class="value">${data.proofUploadedCount}/${data.totalItems}</div></div>
    </section>

    <h2>Executed Inventory</h2>
    ${data.items
      .map(
        (item) => `
          <section class="card">
            <h3>${escapeHtml(item.title)}</h3>
            <table>
              <tr><td><strong>Inventory Code</strong></td><td>${escapeHtml(item.inventoryCode)}</td></tr>
              <tr><td><strong>Category</strong></td><td>${escapeHtml(item.categoryGroup)} · ${escapeHtml(item.subCategory)}</td></tr>
              <tr><td><strong>City / Area</strong></td><td>${escapeHtml(item.city)} / ${escapeHtml(item.area)}</td></tr>
              <tr><td><strong>Size</strong></td><td>${escapeHtml(formatSize(item as any))}</td></tr>
              <tr><td><strong>Campaign Dates</strong></td><td>${escapeHtml(formatDateRange(item.campaignStartDate, item.campaignEndDate))}</td></tr>
              <tr><td><strong>Location / Route</strong></td><td>${escapeHtml(formatLocation(item))}</td></tr>
              <tr><td><strong>Mounted / Deployed On</strong></td><td>${escapeHtml(formatDate(item.mounting?.completedAt))}</td></tr>
              <tr><td><strong>Proof Notes</strong></td><td>${escapeHtml(item.proof?.notes || '-')}</td></tr>
            </table>
            ${proofLinks(item.proof?.photoUrls || [])}
          </section>
        `,
      )
      .join('')}
  `;

  return documentShell({
    title: 'Campaign Execution Report',
    subtitle: 'Client-facing proof report after campaign execution.',
    generatedAt: data.generatedAt,
    body,
  });
};
