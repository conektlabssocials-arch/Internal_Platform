import { Router } from 'express';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { requireMcpAccess } from './mcpAuth.js';
import type { McpActor } from './mcpAuth.js';
import { createPhase1McpServer } from './mcpServer.js';

const router = Router();

router.use(requireMcpAccess);

router.post('/', async (req, res) => {
  const actor = res.locals.mcpActor as McpActor;
  const scopes = (res.locals.mcpScopes || []) as string[];
  const server = createPhase1McpServer(actor, scopes);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request failed', error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal MCP server error',
        },
        id: null,
      });
    }
    await transport.close();
    await server.close();
  }
});

const methodNotAllowed = (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed for this stateless MCP server',
    },
    id: null,
  });
};

router.get('/', methodNotAllowed);
router.delete('/', methodNotAllowed);

export default router;
