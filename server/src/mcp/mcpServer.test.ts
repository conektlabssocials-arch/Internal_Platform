import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { container } from '../config/container.js';
import { TOKENS } from '../config/tokens.js';
import type { InventoryFiltersDto } from '../dto/inventory.dto.js';
import type { ICampaignCommandService } from '../services/campaignCommand.service.js';
import type { IInventoryService } from '../services/inventory.service.js';
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
