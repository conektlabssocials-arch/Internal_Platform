import assert from 'node:assert/strict';
import test from 'node:test';

import {
  configuredMcpScopes,
  MCP_SCOPES,
  supportedMcpScopes,
} from './mcpScopes.js';

test('OAuth scope configuration defaults to every supported MCP scope', () => {
  const previous = process.env.MCP_SHARED_SCOPES;
  delete process.env.MCP_SHARED_SCOPES;

  try {
    assert.deepEqual(configuredMcpScopes(), supportedMcpScopes);
  } finally {
    if (previous === undefined) delete process.env.MCP_SHARED_SCOPES;
    else process.env.MCP_SHARED_SCOPES = previous;
  }
});

test('configured MCP scopes accept spaces or commas and discard unknown scopes', () => {
  const previous = process.env.MCP_SHARED_SCOPES;
  process.env.MCP_SHARED_SCOPES =
    'platform:read, campaigns:write unknown:scope documents:write';

  try {
    assert.deepEqual(configuredMcpScopes(), [
      MCP_SCOPES.PlatformRead,
      MCP_SCOPES.CampaignsWrite,
      MCP_SCOPES.DocumentsWrite,
    ]);
  } finally {
    if (previous === undefined) delete process.env.MCP_SHARED_SCOPES;
    else process.env.MCP_SHARED_SCOPES = previous;
  }
});
