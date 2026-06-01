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
  loginWithGoogle(idToken?: string): Promise<{ token: string; user: UserDto }>;
  getCurrentUser(token?: string): Promise<UserDto>;
  getCookieName(): string;
  getCookieOptions(): CookieOptions;
  verifyAuthToken(token?: string): AuthTokenPayload;
}

const getJwtSecret = () => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new HttpError(500, 'JWT_SECRET is required');
  }

  return jwtSecret;
};

const getGoogleClientId = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new HttpError(500, 'GOOGLE_CLIENT_ID is required');
  }

  return clientId;
};

const shouldUseSecureCookie = () => process.env.COOKIE_SECURE !== 'false';

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
    return {
      httpOnly: true,
      secure: shouldUseSecureCookie(),
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    };
  }

  verifyAuthToken(token?: string) {
    if (!token) {
      throw new HttpError(401, 'Authentication required');
    }

    try {
      return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    } catch {
      throw new HttpError(401, 'Invalid or expired session');
    }
  }

  async loginWithGoogle(idToken?: string) {
    if (!idToken) {
      throw new HttpError(400, 'Google credential is required');
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: getGoogleClientId(),
    });
    const payload = ticket.getPayload();

    if (!payload) {
      throw new HttpError(401, 'Google account could not be verified');
    }

    const email = payload?.email?.toLowerCase();

    if (!email || !payload.email_verified) {
      throw new HttpError(401, 'Google account email could not be verified');
    }

    const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN;
    console.log("allowedDomain", allowedDomain)
console.log('Google token claims:', {
  email: payload.email,
  emailVerified: payload.email_verified,
  hostedDomain: payload.hd,
  audience: payload.aud,
});
    if (allowedDomain && payload.hd !== allowedDomain) {
      throw new HttpError(403, 'Google Workspace account is not allowed');
    }

    const userDto = await this.userService.recordLoginByEmail(email);
    const token = this.createAuthToken({
      userId: userDto.id,
      email: userDto.email,
      role: userDto.role,
    });

    return { token, user: userDto };
  }

  async getCurrentUser(token?: string) {
    const payload = this.verifyAuthToken(token);
    return this.userService.getActiveUserDtoById(payload.userId);
  }

  private createAuthToken(payload: AuthTokenPayload) {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn'];

    return jwt.sign(payload, getJwtSecret(), { expiresIn });
  }
}
