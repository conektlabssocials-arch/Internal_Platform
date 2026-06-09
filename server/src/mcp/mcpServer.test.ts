import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { container } from '../config/container.js';
import { TOKENS } from '../config/tokens.js';
import type { InventoryFiltersDto } from '../dto/inventory.dto.js';
import type { IInventoryService } from '../services/inventory.service.js';
import { createPhase1McpServer } from './mcpServer.js';

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
