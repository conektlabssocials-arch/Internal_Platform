import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { container } from '../config/container.js';
import { TOKENS } from '../config/tokens.js';
import type { InventoryFiltersDto } from '../dto/inventory.dto.js';
import type { ICampaignCommandService } from '../services/campaignCommand.service.js';
import type { IInventoryService } from '../services/inventory.service.js';
import type { IOperationCommandService } from '../services/operationCommand.service.js';
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
  assert.equal(tools.tools.length, 22);
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
