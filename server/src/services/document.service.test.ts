import assert from 'node:assert/strict';
import test from 'node:test';

import { buildInternalCostSheetHtml } from '../templates/internalCostSheet.template.js';
import { buildPlanProposalHtml } from '../templates/planProposal.template.js';
import { buildQuotationHtml } from '../templates/quotation.template.js';
import type { TemplatePlanData } from '../templates/template.utils.js';
import { buildDocumentFileName } from './pdf.service.js';

const data: TemplatePlanData = {
  generatedAt: new Date('2026-06-06T00:00:00.000Z'),
  campaignCode: 'CMP-2026-0002',
  campaignTitle: 'Bangalore Outdoor Campaign',
  campaignBrief: 'Launch campaign',
  clientName: 'Fresh Basket',
  planVersionLabel: 'v1',
  clientNotes: 'Client-facing note',
  internalNotes: 'SECRET_INTERNAL_NOTE',
  items: [
    {
      inventoryCode: 'OOH-BLR-001',
      title: 'Junction Hoarding',
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      city: 'Bengaluru',
      area: 'Koramangala',
      location: {
        address: '80 Feet Road, Koramangala',
        latitude: 12.9352,
        longitude: 77.6245,
      },
      quantity: 1,
      unitSellingPrice: 500000,
      totalSellingPrice: 500000,
      unitInternalCost: 350000,
      totalInternalCost: 350000,
      marginAmount: 150000,
      marginPercentage: 30,
    },
  ],
  pricing: {
    subtotal: 500000,
    taxPercentage: 18,
    taxAmount: 90000,
    grandTotal: 590000,
    internalCostTotal: 350000,
    marginAmount: 150000,
    marginPercentage: 30,
  },
};

test('client PDF templates do not render internal cost, margin, or internal notes', () => {
  for (const html of [buildPlanProposalHtml(data), buildQuotationHtml(data)]) {
    assert.equal(html.includes('SECRET_INTERNAL_NOTE'), false);
    assert.equal(html.includes('Internal Cost'), false);
    assert.equal(html.includes('Margin %'), false);
    assert.equal(html.includes('₹3,50,000'), false);
  }
});

test('internal cost sheet renders internal cost and margin information', () => {
  const html = buildInternalCostSheetHtml(data);
  assert.match(html, /SECRET_INTERNAL_NOTE/);
  assert.match(html, /Internal Cost/);
  assert.match(html, /Margin %/);
  assert.match(html, /₹3,50,000/);
});

test('document file names are sanitized and versioned', () => {
  const fileName = buildDocumentFileName({
    campaignCode: 'CMP / 2026',
    planVersionLabel: 'v1',
    documentType: 'PlanProposal',
  });
  assert.match(fileName, /^CMP-2026-v1-PlanProposal-/);
  assert.match(fileName, /\.pdf$/);
  assert.equal(fileName.includes('/'), false);
});

test('plan proposal includes a client-safe Outdoor location fallback table', () => {
  const html = buildPlanProposalHtml(data);
  assert.match(html, /Outdoor Site Locations/);
  assert.match(html, /80 Feet Road, Koramangala/);
  assert.match(html, /12\.9352/);
  assert.match(html, /Interactive map view is available/);
  assert.equal(html.includes('SECRET_INTERNAL_NOTE'), false);
});
