import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { UserDto } from '../dto/user.dto.js';
import type { IActivityService } from '../services/activity.service.js';
import type { IAuthService } from '../services/auth.service.js';
import { HttpError } from '../utils/httpError.js';

@injectable()
export class AuthController {
  constructor(
    @inject(TOKENS.AuthService)
    private readonly authService: IAuthService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  postGoogleLogin = async (req: Request, res: Response) => {
    try {
      const session = await this.authService.loginWithGoogleIdToken(
        req.body?.credential,
      );
      await this.finishLogin(session.user, 'Google', req);
      this.setSessionCookie(res, session.token);
      res.status(200).json({ user: session.user });
    } catch (error) {
      await this.logBlockedLogin(req.body?.email, 'google_id_token', req);
      throw error;
    }
  };

  postDevLogin = async (req: Request, res: Response) => {
    try {
      const session = await this.authService.loginForDevelopment(req.body?.email);
      await this.finishLogin(session.user, 'Development', req);
      this.setSessionCookie(res, session.token);
      res.status(200).json({ user: session.user });
    } catch (error) {
      await this.logBlockedLogin(req.body?.email, 'development', req);
      throw error;
    }
  };

  getGoogleCallback = async (req: Request, res: Response) => {
    const user = req.user as UserDto | undefined;
    if (!user) throw new HttpError(401, 'Google sign-in failed');

    const session = this.authService.createSession(user);
    await this.finishLogin(user, 'Google', req);
    this.setSessionCookie(res, session.token);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/`);
  };

  postLogout = async (req: Request, res: Response) => {
    const token = req.cookies?.[this.authService.getCookieName()];
    try {
      const user = await this.authService.getCurrentUser(token);
      await this.activity.logEntityActivity({
        actor: { userId: user.id, email: user.email, role: user.role },
        actorName: user.name,
        action: ACTIVITY_ACTIONS.USER_LOGOUT,
        entityType: 'User',
        entityId: user.id,
        entityTitle: user.name,
        message: `${user.name} logged out.`,
        req,
      });
    } catch {
      // Logout remains idempotent when there is no valid session.
    }
    res.clearCookie(
      this.authService.getCookieName(),
      this.authService.getClearCookieOptions(),
    );
    res.status(200).json({ success: true });
  };

  getMe = async (req: Request, res: Response) => {
    const token = req.cookies?.[this.authService.getCookieName()];
    try {
      const user = await this.authService.getCurrentUser(token);
      res.status(200).json({ user });
    } catch (error) {
      res.clearCookie(
        this.authService.getCookieName(),
        this.authService.getClearCookieOptions(),
      );
      if (error instanceof HttpError && error.statusCode === 403) {
        throw new HttpError(401, 'Your account is inactive. Contact Admin.');
      }
      throw error;
    }
  };

  private setSessionCookie(res: Response, token: string) {
    res.cookie(
      this.authService.getCookieName(),
      token,
      this.authService.getCookieOptions(),
    );
  }

  private async finishLogin(user: UserDto, provider: string, req: Request) {
    await this.activity.logEntityActivity({
      actor: { userId: user.id, email: user.email, role: user.role },
      actorName: user.name,
      action: ACTIVITY_ACTIONS.USER_LOGIN,
      entityType: 'User',
      entityId: user.id,
      entityTitle: user.name,
      message: `${user.name} logged in with ${provider}.`,
      metadata: { provider: provider.toLowerCase() },
      req,
    });
  }

  private logBlockedLogin(email: unknown, provider: string, req: Request) {
    return this.activity.logEntityActivity({
      actor: null,
      actorName: provider === 'development' ? 'Development login' : 'Google SSO',
      action: ACTIVITY_ACTIONS.USER_LOGIN_BLOCKED,
      entityType: 'User',
      entityTitle: typeof email === 'string' ? email.toLowerCase() : undefined,
      message: 'A login attempt was blocked.',
      metadata: {
        email: typeof email === 'string' ? email.toLowerCase() : undefined,
        provider,
      },
      visibility: 'admin_only',
      req,
    });
  }
}

export const oauthStateCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 10 * 60 * 1000,
  path: '/api/auth/google/callback',
});

export const oauthStateClearCookieOptions = () => {
  const { maxAge: _maxAge, ...options } = oauthStateCookieOptions();
  return options;
};
