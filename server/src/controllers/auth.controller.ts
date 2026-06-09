import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { IActivityService } from '../services/activity.service.js';
import type { IAuthService } from '../services/auth.service.js';

@injectable()
export class AuthController {
  constructor(
    @inject(TOKENS.AuthService)
    private readonly authService: IAuthService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  postGoogleLogin = async (req: Request, res: Response) => {
    const { token, user } = await this.authService.loginWithGoogle(req.body.credential);
    await this.activity.logEntityActivity({
      actor: { userId: user.id, email: user.email, role: user.role },
      actorName: user.name, action: ACTIVITY_ACTIONS.USER_LOGIN, entityType: 'User',
      entityId: user.id, entityTitle: user.name, message: `${user.name} logged in.`, req,
    });

    res.cookie(this.authService.getCookieName(), token, this.authService.getCookieOptions());
    res.status(200).json({ user });
  };

  postLogout = async (req: Request, res: Response) => {
    const token = req.cookies?.[this.authService.getCookieName()];
    try {
      const user = await this.authService.getCurrentUser(token);
      await this.activity.logEntityActivity({
        actor: { userId: user.id, email: user.email, role: user.role },
        actorName: user.name, action: ACTIVITY_ACTIONS.USER_LOGOUT, entityType: 'User',
        entityId: user.id, entityTitle: user.name, message: `${user.name} logged out.`, req,
      });
    } catch {
      // Logout remains idempotent when there is no valid session.
    }
    res.clearCookie(this.authService.getCookieName(), this.authService.getCookieOptions());
    res.status(200).json({ success: true });
  };

  getMe = async (req: Request, res: Response) => {
    const token = req.cookies?.[this.authService.getCookieName()];
    const user = await this.authService.getCurrentUser(token);

    res.status(200).json({ user });
  };
}
