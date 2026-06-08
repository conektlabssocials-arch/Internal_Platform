import {
  documentShell,
  escapeHtml,
  formatBoolean,
  formatDate,
  formatDateRange,
  formatLocation,
  formatSize,
  type TemplateOperationData,
} from './template.utils.js';

const statusText = (required?: boolean, done?: boolean) => {
  if (required === false) return 'Not required';
  return done ? 'Done' : 'Pending';
};

export const buildWorkOrderHtml = (data: TemplateOperationData) => {
  const pendingItems = data.items.filter(
    (item) => item.itemStatus !== 'Completed' && item.itemStatus !== 'Proof Uploaded',
  );
  const proofPendingItems = data.items.filter(
    (item) => item.mounting?.completed && !item.proof?.uploaded,
  );

  const body = `
    <section class="meta">
      <div><div class="label">Operation Code</div><div class="value">${escapeHtml(data.operationCode)}</div></div>
      <div><div class="label">Campaign</div><div class="value">${escapeHtml(data.campaignCode)} · ${escapeHtml(data.campaignTitle)}</div></div>
      <div><div class="label">Client</div><div class="value">${escapeHtml(data.clientName)}</div></div>
      <div><div class="label">Plan Version</div><div class="value">${escapeHtml(data.planVersionLabel)}</div></div>
    </section>
    <section class="meta">
      <div><div class="label">Status</div><div class="value">${escapeHtml(data.operationStatus)}</div></div>
      <div><div class="label">Owner</div><div class="value">${escapeHtml(data.operationOwnerName || 'Unassigned')}</div></div>
      <div><div class="label">Generated</div><div class="value">${escapeHtml(formatDate(data.generatedAt))}</div></div>
    </section>

    <h2>Execution Checklist</h2>
    <div class="grid">
      <div class="card"><div class="label">Creative Received</div><div class="value">${data.items.filter((item) => item.creative?.received).length}/${data.totalItems}</div></div>
      <div class="card"><div class="label">PO Sent</div><div class="value">${data.items.filter((item) => item.purchaseOrder?.sent).length}/${data.totalItems}</div></div>
      <div class="card"><div class="label">Mounted</div><div class="value">${data.mountedCount}/${data.totalItems}</div></div>
      <div class="card"><div class="label">Proof Uploaded</div><div class="value">${data.proofUploadedCount}/${data.totalItems}</div></div>
      <div class="card"><div class="label">Pending Items</div><div class="value">${pendingItems.length}</div></div>
      <div class="card"><div class="label">Proof Pending</div><div class="value">${proofPendingItems.length}</div></div>
    </div>

    ${data.notes ? `<h2>Operation Notes</h2><div class="note">${escapeHtml(data.notes)}</div>` : ''}

    <h2>Operation Items</h2>
    <table>
      <thead>
        <tr>
          <th>Inventory</th>
          <th>Category</th>
          <th>Location / Route</th>
          <th>Dates</th>
          <th>Supplier / Owner</th>
          <th>Creative</th>
          <th>PO</th>
          <th>Mounting</th>
          <th>Proof</th>
          <th>Takedown</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
          .map(
            (item) => `
              <tr>
                <td><strong>${escapeHtml(item.inventoryCode)}</strong><br>${escapeHtml(item.title)}<br><span class="muted">${escapeHtml(formatSize(item as any))}</span></td>
                <td>${escapeHtml(item.categoryGroup)}<br><span class="muted">${escapeHtml(item.subCategory)}</span></td>
                <td>${escapeHtml(item.city)} / ${escapeHtml(item.area)}<br><span class="muted">${escapeHtml(formatLocation(item))}</span></td>
                <td>${escapeHtml(formatDateRange(item.campaignStartDate, item.campaignEndDate))}</td>
                <td>${escapeHtml(item.supplierName || 'Supplier not assigned')}<br><span class="muted">${escapeHtml(item.ownerName || '')}</span></td>
                <td>${escapeHtml(statusText(item.creative?.required, item.creative?.received))}</td>
                <td>${escapeHtml(statusText(item.purchaseOrder?.required, item.purchaseOrder?.sent))}</td>
                <td>${escapeHtml(formatDate(item.mounting?.scheduledDate))}<br>Completed: ${escapeHtml(formatBoolean(item.mounting?.completed))}</td>
                <td>${escapeHtml(statusText(true, item.proof?.uploaded))}</td>
                <td>${escapeHtml(statusText(item.takedown?.required, item.takedown?.completed))}<br>${escapeHtml(formatDate(item.takedown?.scheduledDate))}</td>
                <td>${escapeHtml(item.mounting?.internalNotes || item.notes || '-')}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>

    <h2>Pending Items</h2>
    ${
      pendingItems.length
        ? `<ul>${pendingItems.map((item) => `<li>${escapeHtml(item.inventoryCode)} · ${escapeHtml(item.title)} · ${escapeHtml(item.itemStatus)}</li>`).join('')}</ul>`
        : '<p class="muted">No pending execution items.</p>'
    }
  `;

  return documentShell({
    title: 'Work Order',
    subtitle: 'Internal checklist for operations execution.',
    generatedAt: data.generatedAt,
    body,
  });
};
