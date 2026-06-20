import assert from 'node:assert/strict';
import test from 'node:test';

import { buildInternalCostSheetHtml } from '../templates/internalCostSheet.template.js';
import { buildExecutionReportHtml } from '../templates/executionReport.template.js';
import { buildPlanProposalHtml } from '../templates/planProposal.template.js';
import { buildPlanProposalV2Html } from '../templates/planProposalV2.template.js';
import { buildPurchaseOrderHtml } from '../templates/purchaseOrder.template.js';
import { buildQuotationHtml } from '../templates/quotation.template.js';
import type {
  TemplateOperationData,
  TemplatePlanData,
} from '../templates/template.utils.js';
import { buildWorkOrderHtml } from '../templates/workOrder.template.js';
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
      illumination: 'Backlit',
      location: {
        address: '80 Feet Road, Koramangala, Bengaluru, Karnataka, 560034, India',
        latitude: 12.935212345,
        longitude: 77.624598765,
      },
      photos: ['https://example.com/site.jpg'],
      width: 20,
      height: 10,
      totalSqFt: 200,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-31T00:00:00.000Z'),
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

const operationData: TemplateOperationData = {
  generatedAt: new Date('2026-06-08T00:00:00.000Z'),
  operationCode: 'OPS-2026-0001',
  campaignCode: 'CMP-2026-0002',
  campaignTitle: 'Bangalore Outdoor Campaign',
  clientName: 'Fresh Basket',
  planVersionLabel: 'v1',
  operationStatus: 'In Progress',
  operationOwnerName: 'Ajmal',
  notes: 'SECRET_OPERATION_NOTE',
  poNumber: 'PO-2026-0001',
  partial: true,
  proofUploadedCount: 1,
  mountedCount: 1,
  totalItems: 2,
  items: [
    {
      inventoryCode: 'OOH-BLR-001',
      title: 'Junction Hoarding',
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      city: 'Bengaluru',
      area: 'Koramangala',
      location: { address: '80 Feet Road, Koramangala' },
      campaignStartDate: new Date('2026-07-01T00:00:00.000Z'),
      campaignEndDate: new Date('2026-07-31T00:00:00.000Z'),
      supplierName: 'SECRET_SUPPLIER',
      unitInternalCost: 350000,
      totalInternalCost: 350000,
      unitSellingPrice: 500000,
      totalSellingPrice: 500000,
      creative: { required: true, received: true },
      purchaseOrder: { required: true, sent: true },
      mounting: {
        completed: true,
        completedAt: new Date('2026-07-01T00:00:00.000Z'),
        internalNotes: 'SECRET_INTERNAL_NOTE',
      },
      proof: {
        uploaded: true,
        photoUrls: ['https://example.com/proof.jpg'],
        notes: 'Installed successfully',
      },
      takedown: { required: true, completed: false },
      itemStatus: 'Proof Uploaded',
    },
    {
      inventoryCode: 'BUS-BLR-001',
      title: 'Bus Branding',
      categoryGroup: 'Bus',
      city: 'Bengaluru',
      route: 'Silk Board to Marathahalli',
      unitInternalCost: 0,
      totalInternalCost: 0,
      proof: { uploaded: false, photoUrls: [] },
      mounting: { completed: false },
      itemStatus: 'Pending',
    },
  ],
};

test('client PDF templates do not render internal cost, margin, or internal notes', () => {
  for (const html of [
    buildPlanProposalHtml(data),
    buildPlanProposalV2Html(data),
    buildQuotationHtml(data),
  ]) {
    assert.equal(html.includes('SECRET_INTERNAL_NOTE'), false);
    assert.equal(html.includes('Internal Cost'), false);
    assert.equal(html.includes('Margin %'), false);
    assert.equal(html.includes('₹3,50,000'), false);
  }
});

test('plan proposal V2 follows the landscape inventory presentation', () => {
  const html = buildPlanProposalV2Html(data);
  assert.match(html, /Media Plan Proposal V2/);
  assert.match(html, /Plan Overview/);
  assert.match(html, /Site Inventory Summary/);
  assert.match(html, /LOCATION 01/);
  assert.match(html, /https:\/\/example.com\/site.jpg/);
  assert.match(html, /A4 landscape/);
});

test('plan proposal V2 shows A3 property audience metrics', () => {
  const html = buildPlanProposalV2Html({
    ...data,
    items: [{
      ...data.items[0],
      categoryGroup: 'A3 Screens',
      subCategory: 'Residential',
      width: 3,
      height: 2,
      screenSize: '32 inch LED TV',
      numberOfScreens: 4,
      households: 202,
      approxReach: 898,
      monthlyImpressions: 26670,
      buildingAge: 23,
    }],
  });

  assert.match(html, /Property Audience/);
  assert.match(html, /Households \/ Flats/);
  assert.match(html, /26,670/);
  assert.match(html, /32 inch LED TV/);
  assert.match(html, /2 H x 3 W/);
  assert.match(html, /No\. of Screens/);
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

test('plan proposal includes a client-safe fixed-site location fallback table', () => {
  const html = buildPlanProposalHtml(data);
  assert.match(html, /@page \{ size: A4 landscape; margin: 18mm 14mm; background: #fbfaf6; \}/);
  assert.match(html, /body \{[\s\S]*background: #fbfaf6/);
  assert.match(html, /Fixed Site Locations/);
  // Long reverse-geocoded address is trimmed to a few key parts (no pincode/country).
  assert.match(html, /80 Feet Road, Koramangala, Bengaluru/);
  assert.equal(html.includes('560034'), false);
  assert.equal(html.includes('India'), false);
  // Coordinates are limited to 4 decimal places.
  assert.match(html, /12\.9352/);
  assert.equal(html.includes('12.935212345'), false);
  // Illumination type is surfaced to the client.
  assert.match(html, /Illumination/);
  assert.match(html, /Backlit/);
  assert.match(html, /Interactive map view is available/);
  assert.equal(html.includes('SECRET_INTERNAL_NOTE'), false);
});

test('work order renders internal execution details', () => {
  const html = buildWorkOrderHtml(operationData);
  assert.match(html, /Work Order/);
  assert.match(html, /SECRET_OPERATION_NOTE/);
  assert.match(html, /SECRET_INTERNAL_NOTE/);
  assert.match(html, /SECRET_SUPPLIER/);
});

test('purchase order renders supplier cost without margin or selling price', () => {
  const html = buildPurchaseOrderHtml(operationData);
  assert.match(html, /PO-2026-0001/);
  assert.match(html, /SECRET_SUPPLIER/);
  assert.match(html, /₹3,50,000/);
  assert.equal(html.includes('Margin'), false);
  assert.equal(html.includes('₹5,00,000'), false);
});

test('execution report is client-safe and marks partial reports', () => {
  const html = buildExecutionReportHtml(operationData);
  assert.match(html, /Partial Execution Report/);
  assert.match(html, /https:\/\/example.com\/proof.jpg/);
  assert.equal(html.includes('SECRET_SUPPLIER'), false);
  assert.equal(html.includes('SECRET_OPERATION_NOTE'), false);
  assert.equal(html.includes('SECRET_INTERNAL_NOTE'), false);
  assert.equal(html.includes('₹3,50,000'), false);
  assert.equal(html.includes('₹5,00,000'), false);
  assert.equal(html.includes('Margin'), false);
});
