import { inject, injectable } from 'tsyringe';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import type { SignOptions } from 'jsonwebtoken';

import { TOKENS } from '../config/tokens.js';
import type { UserDto } from '../dto/user.dto.js';
import type { IUserService } from './user.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

export interface IAuthService {
  loginWithGoogleIdToken(idToken?: string): Promise<{ token: string; user: UserDto }>;
  loginForDevelopment(email?: string): Promise<{ token: string; user: UserDto }>;
  createSession(user: UserDto): { token: string; user: UserDto };
  getCurrentUser(token?: string): Promise<UserDto>;
  getCookieName(): string;
  getCookieOptions(): CookieOptions;
  getClearCookieOptions(): CookieOptions;
  verifyAuthToken(token?: string): AuthTokenPayload;
}

const getJwtSecret = () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new HttpError(500, 'JWT_SECRET is required');
  return jwtSecret;
};

const getGoogleClientId = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new HttpError(500, 'GOOGLE_CLIENT_ID is required');
  return clientId;
};

const allowedDomains = () =>
  (
    process.env.AUTH_ALLOWED_DOMAINS ||
    process.env.GOOGLE_WORKSPACE_DOMAIN ||
    process.env.GOOGLE_ALLOWED_DOMAIN ||
    ''
  )
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

const durationMs = (value = '8h') => {
  const match = /^(\d+)(ms|s|m|h|d)?$/i.exec(value.trim());
  if (!match) return 8 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[(match[2] || 'ms').toLowerCase()];
};

@injectable()
export class AuthService implements IAuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    @inject(TOKENS.UserService)
    private readonly userService: IUserService,
  ) {}

  getCookieName() {
    return process.env.COOKIE_NAME || 'conekt_ads_token';
  }

  getCookieOptions(): CookieOptions {
    const production = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: production,
      sameSite: production ? 'strict' : 'lax',
      maxAge: durationMs(process.env.JWT_EXPIRES_IN || '8h'),
      path: '/',
    };
  }

  getClearCookieOptions(): CookieOptions {
    const { maxAge: _maxAge, ...options } = this.getCookieOptions();
    return options;
  }

  verifyAuthToken(token?: string) {
    if (!token) throw new HttpError(401, 'Authentication required');
    try {
      return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    } catch {
      throw new HttpError(401, 'Invalid or expired session');
    }
  }

  async loginWithGoogleIdToken(idToken?: string) {
    if (!idToken) throw new HttpError(400, 'Google credential is required');

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: getGoogleClientId(),
    });
    const payload = ticket.getPayload();
    if (!payload) throw new HttpError(401, 'Google account could not be verified');

    const email = payload.email?.toLowerCase();
    if (!email || !payload.email_verified) {
      throw new HttpError(401, 'Google account email could not be verified');
    }

    const domains = allowedDomains();
    const emailDomain = email.split('@')[1];
    if (
      domains.length &&
      (!domains.includes(emailDomain) || (payload.hd && !domains.includes(payload.hd)))
    ) {
      throw new HttpError(403, 'Google Workspace account is not allowed');
    }

    const user = await this.userService.recordGoogleLogin({
      email,
      googleId: payload.sub,
      avatarUrl: payload.picture,
    });
    return this.createSession(user);
  }

  async loginForDevelopment(email?: string) {
    // Development only. Never enabled in production.
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.DEV_AUTH_ENABLED !== 'true'
    ) {
      throw new HttpError(404, 'Development login is not available');
    }
    if (!email?.trim()) throw new HttpError(400, 'Email is required');
    return this.createSession(await this.userService.recordDevLogin(email));
  }

  createSession(user: UserDto) {
    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn'];
    return {
      token: jwt.sign(payload, getJwtSecret(), { expiresIn }),
      user,
    };
  }

  async getCurrentUser(token?: string) {
    const payload = this.verifyAuthToken(token);
    return this.userService.getActiveUserDtoById(payload.userId);
  }
}
