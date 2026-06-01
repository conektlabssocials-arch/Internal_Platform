import { inject, injectable } from 'tsyringe';
import type { RequestHandler } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IAuthService } from '../services/auth.service.js';
import { HttpError } from '../utils/httpError.js';

@injectable()
export class AuthMiddleware {
  constructor(
    @inject(TOKENS.AuthService)
    private readonly authService: IAuthService,
  ) {}

  requireAuth: RequestHandler = (req, res, next) => {
    try {
      const token = req.cookies?.[this.authService.getCookieName()];
      const payload = this.authService.verifyAuthToken(token);

      res.locals.authUser = payload;
      next();
    } catch (error) {
      next(error);
    }
  };

  requireAdmin: RequestHandler = (_req, res, next) => {
    const authUser = res.locals.authUser;

    if (!authUser) {
      next(new HttpError(401, 'Authentication required'));
      return;
    }

    if (authUser.role !== 'admin') {
      next(new HttpError(403, 'Admin access required'));
      return;
    }

    next();
  };
}
