import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { container } from '../config/container.js';
import { TOKENS } from '../config/tokens.js';
import type { InventoryFiltersDto } from '../dto/inventory.dto.js';
import type { ICampaignCommandService } from '../services/campaignCommand.service.js';
import type { IInventoryService } from '../services/inventory.service.js';
import type { IInventoryCommandService } from '../services/inventoryCommand.service.js';
import type { IOperationCommandService } from '../services/operationCommand.service.js';
import type { IPlanAuthoringCommandService } from '../services/planAuthoringCommand.service.js';
import { createPhase1McpServer } from './mcpServer.js';
import { MCP_SCOPES } from './mcpScopes.js';

test('search_inventory accepts Claude null and boolean filter values', async () => {
  let receivedFilters: InventoryFiltersDto | undefined;
  const inventoryService = {
    listInventory: async (filters: InventoryFiltersDto) => {
      receivedFilters = filters;
      return {
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
      };
    },
  } as IInventoryService;

  container.registerInstance(TOKENS.InventoryService, inventoryService);

  const server = createPhase1McpServer({
    userId: '000000000000000000000001',
    email: 'admin@conektads.com',
    name: 'Admin',
    role: 'admin',
  });
  const client = new Client({
    name: 'mcp-null-input-regression',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({
    name: 'search_inventory',
    arguments: {
      city: null,
      status: true,
      availabilityStatus: true,
      limit: 50,
    },
  });

  assert.equal(result.isError, undefined);
  assert.deepEqual(receivedFilters, {
    city: undefined,
    status: 'active',
    availabilityStatus: 'available',
    limit: '50',
    page: undefined,
  });

  await client.close();
  await server.close();
});

test('campaign write tools are only exposed with campaigns:write scope', async () => {
  const openClient = async (scopes: string[]) => {
    const server = createPhase1McpServer(
      {
        userId: '000000000000000000000001',
        email: 'admin@conektads.com',
        name: 'Admin',
        role: 'admin',
      },
      scopes,
    );
    const client = new Client({
      name: 'mcp-scope-regression',
      version: '1.0.0',
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return { client, server };
  };

  const readOnly = await openClient([MCP_SCOPES.PlatformRead]);
  const readOnlyTools = await readOnly.client.listTools();
  assert.equal(
    readOnlyTools.tools.some((tool) => tool.name === 'change_campaign_status'),
    false,
  );
  await readOnly.client.close();
  await readOnly.server.close();

  const writable = await openClient([
    MCP_SCOPES.PlatformRead,
    MCP_SCOPES.CampaignsWrite,
  ]);
  const writableTools = await writable.client.listTools();
  assert.equal(
    writableTools.tools.some(
      (tool) => tool.name === 'update_campaign_follow_up',
    ),
    true,
  );
  assert.equal(
    writableTools.tools.some((tool) => tool.name === 'change_campaign_status'),
    true,
  );
  await writable.client.close();
  await writable.server.close();
});

test('campaign write tool requires confirmation and calls the command service', async () => {
  let received:
    | {
        id: string;
        input: Record<string, unknown>;
        actor: Record<string, unknown>;
      }
    | undefined;
  const commandService = {
    updateFollowUp: async (
      id: string,
      input: Record<string, unknown>,
      actor: Record<string, unknown>,
    ) => {
      received = { id, input, actor };
      return {
        id,
        campaignCode: 'CMP-2026-0010',
        title: 'Bangalore Launch',
        status: 'New',
        nextFollowUpAt: new Date('2026-06-12T09:00:00.000Z'),
      };
    },
  } as unknown as ICampaignCommandService;
  container.registerInstance(TOKENS.CampaignCommandService, commandService);

  const actor = {
    userId: '000000000000000000000001',
    email: 'admin@conektads.com',
    name: 'Admin',
    role: 'admin' as const,
  };
  const server = createPhase1McpServer(actor, [
    MCP_SCOPES.PlatformRead,
    MCP_SCOPES.CampaignsWrite,
  ]);
  const client = new Client({
    name: 'mcp-write-regression',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const rejected = await client.callTool({
    name: 'update_campaign_follow_up',
    arguments: {
      campaignId: '000000000000000000000010',
      nextFollowUpAt: '2026-06-12T09:00:00.000Z',
      confirm: false,
    },
  });
  assert.equal(rejected.isError, true);
  assert.equal(received, undefined);

  const accepted = await client.callTool({
    name: 'update_campaign_follow_up',
    arguments: {
      campaignId: '000000000000000000000010',
      nextFollowUpAt: '2026-06-12T09:00:00.000Z',
      expectedCurrentFollowUpAt: '2026-06-10T09:00:00.000Z',
      followUpNote: 'Call client',
      confirm: true,
    },
  });

  assert.equal(accepted.isError, undefined);
  assert.equal(received?.id, '000000000000000000000010');
  assert.deepEqual(received?.input, {
    nextFollowUpAt: '2026-06-12T09:00:00.000Z',
    expectedCurrentFollowUpAt: '2026-06-10T09:00:00.000Z',
    followUpNote: 'Call client',
  });
  assert.deepEqual(received?.actor, actor);

  await client.close();
  await server.close();
});

test('Phase 3 scopes expose plan and operation workflow tools', async () => {
  const server = createPhase1McpServer(
    {
      userId: '000000000000000000000001',
      email: 'admin@conektads.com',
      name: 'Admin',
      role: 'admin',
    },
    [
      MCP_SCOPES.PlatformRead,
      MCP_SCOPES.CampaignsWrite,
      MCP_SCOPES.PlansWrite,
      MCP_SCOPES.OperationsWrite,
    ],
  );
  const client = new Client({
    name: 'mcp-phase3-scope-regression',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const tools = await client.listTools();
  const names = new Set(tools.tools.map((tool) => tool.name));
  assert.equal(tools.tools.length, 30);
  assert.equal(names.has('change_plan_status'), true);
  assert.equal(names.has('change_operation_status'), true);
  assert.equal(names.has('update_operation_item_status'), true);
  assert.equal(names.has('update_operation_creative'), true);
  assert.equal(names.has('update_operation_purchase_order'), true);
  assert.equal(names.has('update_operation_mounting'), true);
  assert.equal(names.has('update_operation_proof'), true);
  assert.equal(names.has('update_operation_takedown'), true);

  await client.close();
  await server.close();
});

test('Phase 4 scopes expose document generation and proof upload tools', async () => {
  const server = createPhase1McpServer(
    {
      userId: '000000000000000000000001',
      email: 'admin@conektads.com',
      name: 'Admin',
      role: 'admin',
    },
    Object.values(MCP_SCOPES),
  );
  const client = new Client({
    name: 'mcp-phase4-scope-regression',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const tools = await client.listTools();
  const names = new Set(tools.tools.map((tool) => tool.name));
  assert.equal(tools.tools.length, 48);
  assert.equal(names.has('list_plan_documents'), true);
  assert.equal(names.has('list_operation_documents'), true);
  assert.equal(names.has('generate_plan_document'), true);
  assert.equal(names.has('generate_operation_document'), true);
  assert.equal(names.has('upload_operation_proof_image'), true);
  assert.equal(names.has('upload_inventory_photo'), true);
  assert.equal(names.has('create_draft_plan'), true);
  assert.equal(names.has('update_draft_plan'), true);
  assert.equal(names.has('clone_plan_to_draft'), true);
  assert.equal(names.has('list_plan_share_links'), true);
  assert.equal(names.has('create_plan_share_link'), true);
  assert.equal(names.has('disable_plan_share_link'), true);
  assert.equal(names.has('create_campaign'), true);
  assert.equal(names.has('update_campaign_details'), true);
  assert.equal(names.has('create_crm_entity'), true);
  assert.equal(names.has('update_crm_entity'), true);
  assert.equal(names.has('create_crm_contact'), true);
  assert.equal(names.has('update_crm_contact'), true);
  assert.equal(names.has('confirm_inventory'), true);
  assert.equal(names.has('create_inventory'), true);
  assert.equal(names.has('change_inventory_status'), true);
  assert.equal(names.has('get_campaign_pipeline_report'), true);
  assert.equal(names.has('get_inventory_health_report'), true);
  assert.equal(names.has('get_operations_delivery_report'), true);
  assert.equal(names.has('get_supplier_performance_report'), true);
  assert.equal(names.has('get_profitability_report'), true);

  await client.close();
  await server.close();
});

test('operation proof MCP tool requires confirmation and forwards stale-state data', async () => {
  let received: Record<string, unknown> | undefined;
  const commands = {
    updateItem: async (
      operationId: string,
      itemId: string,
      kind: string,
      input: Record<string, unknown>,
      actor: Record<string, unknown>,
    ) => {
      received = { operationId, itemId, kind, input, actor };
      return {
        id: operationId,
        operationCode: 'OPS-2026-0001',
        status: 'Completed',
        items: [],
      };
    },
  } as unknown as IOperationCommandService;
  container.registerInstance(TOKENS.OperationCommandService, commands);
  const actor = {
    userId: '000000000000000000000001',
    email: 'admin@conektads.com',
    name: 'Admin',
    role: 'admin' as const,
  };
  const server = createPhase1McpServer(actor, [
    MCP_SCOPES.PlatformRead,
    MCP_SCOPES.OperationsWrite,
  ]);
  const client = new Client({
    name: 'mcp-phase3-proof-regression',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const rejected = await client.callTool({
    name: 'update_operation_proof',
    arguments: {
      operationId: '000000000000000000000010',
      itemId: '000000000000000000000040',
      expectedUpdatedAt: '2026-06-10T09:00:00.000Z',
      uploaded: true,
      confirm: false,
    },
  });
  assert.equal(rejected.isError, true);
  assert.equal(received, undefined);

  const accepted = await client.callTool({
    name: 'update_operation_proof',
    arguments: {
      operationId: '000000000000000000000010',
      itemId: '000000000000000000000040',
      expectedUpdatedAt: '2026-06-10T09:00:00.000Z',
      uploaded: true,
      photoUrls: ['https://example.com/proof.jpg'],
      confirm: true,
    },
  });
  assert.equal(accepted.isError, undefined);
  assert.deepEqual(received, {
    operationId: '000000000000000000000010',
    itemId: '000000000000000000000040',
    kind: 'proof',
    input: {
      expectedUpdatedAt: '2026-06-10T09:00:00.000Z',
      mutation: {
        uploaded: true,
        photoUrls: ['https://example.com/proof.jpg'],
        notes: undefined,
      },
    },
    actor,
  });

  await client.close();
  await server.close();
});

test('draft plan MCP tool requires confirmation and forwards commercial inputs', async () => {
  let received: Record<string, unknown> | undefined;
  const commands = {
    create: async (
      campaignId: string,
      input: Record<string, unknown>,
      actor: Record<string, unknown>,
    ) => {
      received = { campaignId, input, actor };
      return {
        id: '000000000000000000000050',
        versionLabel: 'v1',
        title: 'Bangalore Launch - Plan v1',
        status: 'Draft',
        items: [],
        pricing: {},
      };
    },
  } as unknown as IPlanAuthoringCommandService;
  container.registerInstance(TOKENS.PlanAuthoringCommandService, commands);
  const actor = {
    userId: '000000000000000000000001',
    email: 'admin@conektads.com',
    name: 'Admin',
    role: 'admin' as const,
  };
  const server = createPhase1McpServer(actor, [
    MCP_SCOPES.PlatformRead,
    MCP_SCOPES.PlansWrite,
  ]);
  const client = new Client({
    name: 'mcp-phase5-plan-regression',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const argumentsWithoutConfirmation = {
    campaignId: '000000000000000000000020',
    expectedCampaignStatus: 'In Discussion',
    expectedCampaignUpdatedAt: '2026-06-10T08:00:00.000Z',
    items: [
      {
        inventory: '000000000000000000000030',
        quantity: 1,
        unitSellingPrice: 500000,
        unitInternalCost: 350000,
      },
    ],
    taxPercentage: 18,
  };
  const rejected = await client.callTool({
    name: 'create_draft_plan',
    arguments: { ...argumentsWithoutConfirmation, confirm: false },
  });
  assert.equal(rejected.isError, true);
  assert.equal(received, undefined);

  const accepted = await client.callTool({
    name: 'create_draft_plan',
    arguments: { ...argumentsWithoutConfirmation, confirm: true },
  });
  assert.equal(accepted.isError, undefined);
  assert.equal(received?.campaignId, '000000000000000000000020');
  assert.deepEqual(
    (received?.input as { items: unknown[] }).items,
    argumentsWithoutConfirmation.items,
  );
  assert.deepEqual(received?.actor, actor);

  await client.close();
  await server.close();
});

test('inventory confirmation requires confirmation and status tool is admin-only', async () => {
  let received: Record<string, unknown> | undefined;
  const commands = {
    confirm: async (
      inventoryId: string,
      input: Record<string, unknown>,
      actor: Record<string, unknown>,
    ) => {
      received = { inventoryId, input, actor };
      return {
        id: inventoryId,
        inventoryCode: 'OUT-BLR-CBD-0001',
        title: 'MG Road',
        availabilityStatus: 'available',
        confirmationStatus: 'fresh',
      };
    },
  } as unknown as IInventoryCommandService;
  container.registerInstance(TOKENS.InventoryCommandService, commands);
  const member = {
    userId: '000000000000000000000002',
    email: 'member@conektads.com',
    name: 'Member',
    role: 'member' as const,
  };
  const server = createPhase1McpServer(member, [
    MCP_SCOPES.PlatformRead,
    MCP_SCOPES.InventoryWrite,
  ]);
  const client = new Client({
    name: 'mcp-phase6-inventory-regression',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const tools = await client.listTools();
  assert.equal(
    tools.tools.some((tool) => tool.name === 'confirm_inventory'),
    true,
  );
  assert.equal(
    tools.tools.some((tool) => tool.name === 'change_inventory_status'),
    false,
  );

  const argumentsWithoutConfirmation = {
    inventoryId: '000000000000000000000010',
    expectedUpdatedAt: '2026-06-10T09:00:00.000Z',
    availabilityStatus: 'available',
    sellingPrice: 500000,
    confirmationNote: 'Confirmed with owner',
  };
  const rejected = await client.callTool({
    name: 'confirm_inventory',
    arguments: { ...argumentsWithoutConfirmation, confirm: false },
  });
  assert.equal(rejected.isError, true);
  assert.equal(received, undefined);

  const accepted = await client.callTool({
    name: 'confirm_inventory',
    arguments: { ...argumentsWithoutConfirmation, confirm: true },
  });
  assert.equal(accepted.isError, undefined);
  assert.equal(received?.inventoryId, argumentsWithoutConfirmation.inventoryId);
  assert.deepEqual(received?.actor, member);

  await client.close();
  await server.close();
});

test('create inventory requires confirmation and forwards category fields', async () => {
  let received: Record<string, unknown> | undefined;
  const commands = {
    create: async (
      input: Record<string, unknown>,
      actor: Record<string, unknown>,
    ) => {
      received = { input, actor };
      return {
        id: '000000000000000000000010',
        inventoryCode: 'OUT-BLR-CBD-0001',
        ...input,
        status: 'active',
        confirmationStatus: 'never_confirmed',
      };
    },
  } as unknown as IInventoryCommandService;
  container.registerInstance(TOKENS.InventoryCommandService, commands);
  const actor = {
    userId: '000000000000000000000001',
    email: 'admin@conektads.com',
    name: 'Admin',
    role: 'admin' as const,
  };
  const server = createPhase1McpServer(actor, [
    MCP_SCOPES.PlatformRead,
    MCP_SCOPES.InventoryWrite,
  ]);
  const client = new Client({
    name: 'mcp-create-inventory-regression',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const inventoryInput = {
    categoryGroup: 'Outdoor',
    subCategory: 'Hoarding',
    title: 'MG Road Hoarding',
    city: 'Bengaluru',
    area: 'CBD',
    width: 40,
    height: 20,
    location: {
      latitude: 12.975,
      longitude: 77.606,
      address: 'MG Road, Bengaluru',
      source: 'manual',
    },
    availabilityStatus: 'unknown',
  };
  const rejected = await client.callTool({
    name: 'create_inventory',
    arguments: { ...inventoryInput, confirm: false },
  });
  assert.equal(rejected.isError, true);
  assert.equal(received, undefined);

  const accepted = await client.callTool({
    name: 'create_inventory',
    arguments: { ...inventoryInput, confirm: true },
  });
  assert.equal(accepted.isError, undefined);
  assert.deepEqual(received?.input, inventoryInput);
  assert.deepEqual(received?.actor, actor);

  await client.close();
  await server.close();
});

test('create inventory accepts the Mall / SOH category and its fields', async () => {
  let received: Record<string, unknown> | undefined;
  const commands = {
    create: async (input: Record<string, unknown>) => {
      received = input;
      return {
        id: '000000000000000000000011',
        inventoryCode: 'MALL-BLR-WHF-0001',
        ...input,
        status: 'active',
        confirmationStatus: 'never_confirmed',
      };
    },
  } as unknown as IInventoryCommandService;
  container.registerInstance(TOKENS.InventoryCommandService, commands);
  const actor = {
    userId: '000000000000000000000001',
    email: 'admin@conektads.com',
    name: 'Admin',
    role: 'admin' as const,
  };
  const server = createPhase1McpServer(actor, [
    MCP_SCOPES.PlatformRead,
    MCP_SCOPES.InventoryWrite,
  ]);
  const client = new Client({ name: 'mcp-mall-soh-regression', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const mallInput = {
    categoryGroup: 'Mall / SOH',
    subCategory: 'Mall Façade Signage',
    title: 'Mall Façade Signage - Unit 1',
    city: 'Bengaluru',
    area: 'Whitefield',
    width: 29.36,
    height: 22.9,
    illumination: 'Frontlit',
    materialType: 'Star Flex',
    siteLocationLabel: 'Mall Façade',
    unitNumber: '01',
    visibilityNote: 'Main Road, Mall Entry',
    availabilityDate: '2026-02-13',
    sellingPrice: 200000,
    availabilityStatus: 'hold',
  };
  const accepted = await client.callTool({
    name: 'create_inventory',
    arguments: { ...mallInput, confirm: true },
  });
  assert.equal(accepted.isError, undefined);
  assert.deepEqual(received, mallInput);

  // An invalid subCategory for the category is still rejected by the schema enum.
  const rejected = await client.callTool({
    name: 'create_inventory',
    arguments: { ...mallInput, subCategory: 'Not A Real Subcategory', confirm: true },
  });
  assert.equal(rejected.isError, true);

  await client.close();
  await server.close();
});

test('report scope exposes four member reports but hides profitability', async () => {
  const server = createPhase1McpServer(
    {
      userId: '000000000000000000000002',
      email: 'member@conektads.com',
      name: 'Member',
      role: 'member',
    },
    [MCP_SCOPES.PlatformRead, MCP_SCOPES.ReportsRead],
  );
  const client = new Client({
    name: 'mcp-phase7-report-scope',
    version: '1.0.0',
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const tools = await client.listTools();
  const names = new Set(tools.tools.map((tool) => tool.name));
  assert.equal(names.has('get_campaign_pipeline_report'), true);
  assert.equal(names.has('get_inventory_health_report'), true);
  assert.equal(names.has('get_operations_delivery_report'), true);
  assert.equal(names.has('get_supplier_performance_report'), true);
  assert.equal(names.has('get_profitability_report'), false);
  for (const tool of tools.tools.filter((item) => item.name.includes('report'))) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
  }

  await client.close();
  await server.close();
});
