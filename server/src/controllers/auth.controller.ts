import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IAuthService } from '../services/auth.service.js';

@injectable()
export class AuthController {
  constructor(
    @inject(TOKENS.AuthService)
    private readonly authService: IAuthService,
  ) {}

  postGoogleLogin = async (req: Request, res: Response) => {
    const { token, user } = await this.authService.loginWithGoogle(req.body.credential);

    res.cookie(this.authService.getCookieName(), token, this.authService.getCookieOptions());
    res.status(200).json({ user });
  };

  postLogout = async (_req: Request, res: Response) => {
    res.clearCookie(this.authService.getCookieName(), this.authService.getCookieOptions());
    res.status(200).json({ success: true });
  };

  getMe = async (req: Request, res: Response) => {
    const token = req.cookies?.[this.authService.getCookieName()];
    const user = await this.authService.getCurrentUser(token);

    res.status(200).json({ user });
  };
}
