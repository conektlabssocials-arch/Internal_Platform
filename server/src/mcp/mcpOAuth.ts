import { Router } from 'express';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { RequestHandler } from 'express';

import type { McpActor } from './mcpAuth.js';
import {
  ConektMcpOAuthProvider,
  getMcpBaseUrl,
  getMcpResourceUrl,
} from './mcpOAuthProvider.js';
import { MCP_SCOPES, supportedMcpScopes } from './mcpScopes.js';

let provider: ConektMcpOAuthProvider | undefined;

const getProvider = () => {
  provider ||= new ConektMcpOAuthProvider();
  return provider;
};

export const createMcpOAuthRouter = () => {
  const issuerUrl = new URL(`${getMcpBaseUrl()}/`);
  const resourceServerUrl = getMcpResourceUrl();
  const router = Router();
  const oauthProvider = getProvider();

  router.use(
    mcpAuthRouter({
      provider: oauthProvider,
      issuerUrl,
      baseUrl: issuerUrl,
      resourceServerUrl,
      scopesSupported: supportedMcpScopes,
      resourceName: 'Conekt Ads Internal Platform',
      serviceDocumentationUrl: new URL(
        `${getMcpBaseUrl()}/api/health`,
      ),
    }),
  );

  router.get('/oauth/google/callback', async (req, res, next) => {
    const state = req.query.state?.toString();

    try {
      const code = req.query.code?.toString();
      const googleError = req.query.error?.toString();

      if (googleError && state) {
        res.redirect(
          await oauthProvider.failGoogleAuthorization(state, googleError),
        );
        return;
      }
      if (!code || !state) {
        res.status(400).send('Google OAuth callback is missing code or state');
        return;
      }

      const redirectUrl = await oauthProvider.completeGoogleAuthorization(
        code,
        state,
      );
      res.redirect(redirectUrl);
    } catch (error) {
      if (state) {
        try {
          res.redirect(await oauthProvider.failGoogleAuthorization(state));
          return;
        } catch {
          // The original authorization may already be expired or consumed.
        }
      }
      next(error);
    }
  });

  return router;
};

export const requireMcpOAuthAccess: RequestHandler = (req, res, next) => {
  const resourceServerUrl = getMcpResourceUrl();
  const middleware = requireBearerAuth({
    verifier: getProvider(),
    requiredScopes: [MCP_SCOPES.PlatformRead],
    resourceMetadataUrl:
      getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
  });

  middleware(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }

    const actor = req.auth?.extra?.actor as McpActor | undefined;
    if (!actor) {
      res.status(401).json({ error: 'OAuth token has no platform user' });
      return;
    }

    if (req.auth?.resource?.href !== resourceServerUrl.href) {
      res.status(401).json({ error: 'OAuth token resource is invalid' });
      return;
    }

    res.locals.mcpActor = actor;
    res.locals.mcpScopes = req.auth?.scopes || [];
    next();
  });
};
