import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

import { container } from '../config/container.js';
import { TOKENS } from '../config/tokens.js';
import type { UserRole } from '../models/user.model.js';
import type { IUserService } from '../services/user.service.js';
import { requireMcpOAuthAccess } from './mcpOAuth.js';
import { MCP_SCOPES, supportedMcpScopes } from './mcpScopes.js';

export type McpActor = {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
};

const tokensMatch = (provided: string, expected: string) => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};

const unauthorized = (res: Parameters<RequestHandler>[1]) => {
  res.setHeader('WWW-Authenticate', 'Bearer realm="Conekt Ads MCP"');
  res.status(401).json({ error: 'Valid MCP bearer token required' });
};

const requireSharedTokenAccess: RequestHandler = async (req, res, next) => {
  try {
    if (process.env.MCP_ENABLED !== 'true') {
      res.status(404).json({ error: 'MCP server is disabled' });
      return;
    }

    const expectedToken = process.env.MCP_ACCESS_TOKEN;
    const actorEmail = process.env.MCP_ACTOR_EMAIL;

    if (!expectedToken || !actorEmail) {
      res.status(503).json({
        error: 'MCP_ACCESS_TOKEN and MCP_ACTOR_EMAIL must be configured',
      });
      return;
    }

    const authorization = req.header('authorization');
    const providedToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';

    if (!providedToken || !tokensMatch(providedToken, expectedToken)) {
      unauthorized(res);
      return;
    }

    const userService = container.resolve<IUserService>(TOKENS.UserService);
    const user = await userService.getActiveUserByEmail(actorEmail);

    res.locals.mcpActor = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    } satisfies McpActor;
    const configuredScopes = (process.env.MCP_SHARED_SCOPES || MCP_SCOPES.PlatformRead)
      .split(/\s+/)
      .filter((scope) => supportedMcpScopes.includes(scope as never));
    res.locals.mcpScopes = configuredScopes.length
      ? configuredScopes
      : [MCP_SCOPES.PlatformRead];

    next();
  } catch (error) {
    next(error);
  }
};

export const requireMcpAccess: RequestHandler = (req, res, next) => {
  if (process.env.MCP_ENABLED !== 'true') {
    res.status(404).json({ error: 'MCP server is disabled' });
    return;
  }

  if (process.env.MCP_AUTH_MODE === 'oauth') {
    requireMcpOAuthAccess(req, res, next);
    return;
  }

  requireSharedTokenAccess(req, res, next);
};
