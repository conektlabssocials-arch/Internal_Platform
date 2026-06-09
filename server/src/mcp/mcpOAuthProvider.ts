import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { Types } from 'mongoose';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import {
  AccessDeniedError,
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import { McpOAuthAuthorizationModel } from '../models/mcpOAuthAuthorization.model.js';
import { McpOAuthClientModel } from '../models/mcpOAuthClient.model.js';
import { McpOAuthTokenModel } from '../models/mcpOAuthToken.model.js';
import { UserModel } from '../models/user.model.js';

const accessTokenLifetimeSeconds = 60 * 60;
const refreshTokenLifetimeSeconds = 30 * 24 * 60 * 60;
const authorizationLifetimeMs = 10 * 60 * 1000;
const supportedScopes = ['platform:read'];

const randomToken = () => randomBytes(32).toString('base64url');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const expiresAt = (seconds: number) => new Date(Date.now() + seconds * 1000);

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when MCP_AUTH_MODE=oauth`);
  return value;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export const getMcpBaseUrl = () =>
  normalizeBaseUrl(requiredEnv('MCP_BASE_URL'));

export const getMcpResourceUrl = () => new URL(`${getMcpBaseUrl()}/mcp`);

const getGoogleCallbackUrl = () =>
  `${getMcpBaseUrl()}/oauth/google/callback`;

const validateScopes = (scopes: string[] | undefined) => {
  const requested = scopes?.length ? scopes : supportedScopes;
  if (requested.some((scope) => !supportedScopes.includes(scope))) {
    throw new InvalidScopeError('Only platform:read is supported');
  }
  return requested;
};

const validateResource = (resource?: URL) => {
  const expected = getMcpResourceUrl();
  if (resource && resource.href !== expected.href) {
    throw new InvalidTargetError(`resource must be ${expected.href}`);
  }
  return expected;
};

class MongoOAuthClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string) {
    const record = await McpOAuthClientModel.findOne({ clientId }).lean();
    return record?.client as OAuthClientInformationFull | undefined;
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ) {
    const fullClient = client as OAuthClientInformationFull;
    if (!fullClient.client_id) {
      throw new Error('Generated client_id is required');
    }

    await McpOAuthClientModel.findOneAndUpdate(
      { clientId: fullClient.client_id },
      { clientId: fullClient.client_id, client: fullClient },
      { upsert: true, new: true },
    );

    return fullClient;
  }
}

export class ConektMcpOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new MongoOAuthClientsStore();
  private readonly googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(
      requiredEnv('GOOGLE_CLIENT_ID'),
      requiredEnv('GOOGLE_CLIENT_SECRET'),
      getGoogleCallbackUrl(),
    );
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ) {
    const scopes = validateScopes(params.scopes);
    const resource = validateResource(params.resource);
    const upstreamState = randomToken();

    await McpOAuthAuthorizationModel.create({
      upstreamStateHash: hash(upstreamState),
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      requestedState: params.state,
      scopes,
      codeChallenge: params.codeChallenge,
      resource: resource.href,
      expiresAt: new Date(Date.now() + authorizationLifetimeMs),
    });

    const authorizationUrl = this.googleClient.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: ['openid', 'email', 'profile'],
      state: upstreamState,
      hd: process.env.GOOGLE_ALLOWED_DOMAIN || undefined,
    });

    res.redirect(authorizationUrl);
  }

  async completeGoogleAuthorization(code: string, upstreamState: string) {
    const authorization = await McpOAuthAuthorizationModel.findOne({
      upstreamStateHash: hash(upstreamState),
      expiresAt: { $gt: new Date() },
      authorizationCodeHash: { $exists: false },
    });

    if (!authorization) {
      throw new InvalidGrantError('Authorization request is invalid or expired');
    }

    const { tokens } = await this.googleClient.getToken(code);
    if (!tokens.id_token) {
      throw new AccessDeniedError('Google did not return an identity token');
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: requiredEnv('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN;

    if (!email || !payload?.email_verified) {
      throw new AccessDeniedError('Google email could not be verified');
    }
    if (allowedDomain && payload.hd !== allowedDomain) {
      throw new AccessDeniedError('Google Workspace account is not allowed');
    }

    const user = await UserModel.findOne({ email });
    if (!user || user.status !== 'active') {
      throw new AccessDeniedError('User is not active in the platform');
    }

    const authorizationCode = randomToken();
    authorization.authorizationCodeHash = hash(authorizationCode);
    authorization.userId = user._id;
    await authorization.save();

    const redirectUrl = new URL(authorization.redirectUri);
    redirectUrl.searchParams.set('code', authorizationCode);
    if (authorization.requestedState) {
      redirectUrl.searchParams.set('state', authorization.requestedState);
    }
    return redirectUrl.href;
  }

  async failGoogleAuthorization(
    upstreamState: string,
    error = 'access_denied',
  ) {
    const authorization = await McpOAuthAuthorizationModel.findOne({
      upstreamStateHash: hash(upstreamState),
      expiresAt: { $gt: new Date() },
      authorizationCodeHash: { $exists: false },
    });
    if (!authorization) {
      throw new InvalidGrantError('Authorization request is invalid or expired');
    }

    const redirectUrl = new URL(authorization.redirectUri);
    redirectUrl.searchParams.set('error', error);
    redirectUrl.searchParams.set(
      'error_description',
      'Google Workspace authorization was not completed',
    );
    if (authorization.requestedState) {
      redirectUrl.searchParams.set('state', authorization.requestedState);
    }
    return redirectUrl.href;
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ) {
    const authorization = await this.findAuthorization(
      client.client_id,
      authorizationCode,
    );
    return authorization.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ) {
    const authorization = await this.findAuthorization(
      client.client_id,
      authorizationCode,
    );
    validateResource(resource);

    if (redirectUri && redirectUri !== authorization.redirectUri) {
      throw new InvalidGrantError('redirect_uri does not match');
    }
    if (!authorization.userId) {
      throw new InvalidGrantError('Authorization is incomplete');
    }

    authorization.usedAt = new Date();
    await authorization.save();

    return this.issueTokens(
      client.client_id,
      authorization.userId,
      authorization.scopes,
      authorization.resource,
    );
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ) {
    const token = await McpOAuthTokenModel.findOne({
      tokenHash: hash(refreshToken),
      tokenType: 'refresh',
      clientId: client.client_id,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (!token) throw new InvalidGrantError('Refresh token is invalid or expired');
    const requestedScopes = validateScopes(scopes || token.scopes);
    if (requestedScopes.some((scope) => !token.scopes.includes(scope))) {
      throw new InvalidScopeError('Refresh scope exceeds the original grant');
    }

    const expectedResource = validateResource(resource);
    if (token.resource !== expectedResource.href) {
      throw new InvalidTargetError('Refresh token has a different resource');
    }

    token.revokedAt = new Date();
    await token.save();

    return this.issueTokens(
      client.client_id,
      token.userId,
      requestedScopes,
      token.resource,
    );
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = await McpOAuthTokenModel.findOne({
      tokenHash: hash(token),
      tokenType: 'access',
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
    if (!record) throw new InvalidTokenError('Access token is invalid or expired');

    const user = await UserModel.findById(record.userId);
    if (!user || user.status !== 'active') {
      throw new InvalidTokenError('Platform user is inactive');
    }

    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
      resource: new URL(record.resource),
      extra: {
        actor: {
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ) {
    await McpOAuthTokenModel.updateOne(
      { tokenHash: hash(request.token), clientId: client.client_id },
      { revokedAt: new Date() },
    );
  }

  private async findAuthorization(clientId: string, authorizationCode: string) {
    const authorization = await McpOAuthAuthorizationModel.findOne({
      authorizationCodeHash: hash(authorizationCode),
      clientId,
      expiresAt: { $gt: new Date() },
      usedAt: { $exists: false },
    });
    if (!authorization) {
      throw new InvalidGrantError('Authorization code is invalid or expired');
    }
    return authorization;
  }

  private async issueTokens(
    clientId: string,
    userId: Types.ObjectId,
    scopes: string[],
    resource: string,
  ): Promise<OAuthTokens> {
    const accessToken = randomToken();
    const refreshToken = randomToken();

    await McpOAuthTokenModel.create([
      {
        tokenHash: hash(accessToken),
        tokenType: 'access',
        clientId,
        userId,
        scopes,
        resource,
        expiresAt: expiresAt(accessTokenLifetimeSeconds),
      },
      {
        tokenHash: hash(refreshToken),
        tokenType: 'refresh',
        clientId,
        userId,
        scopes,
        resource,
        expiresAt: expiresAt(refreshTokenLifetimeSeconds),
      },
    ]);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: accessTokenLifetimeSeconds,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    };
  }
}
