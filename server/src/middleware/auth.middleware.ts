import { inject, injectable } from 'tsyringe';
import type { RequestHandler } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IAuthService } from '../services/auth.service.js';
import type { IUserService } from '../services/user.service.js';
import { HttpError } from '../utils/httpError.js';

@injectable()
export class AuthMiddleware {
  constructor(
    @inject(TOKENS.AuthService)
    private readonly authService: IAuthService,
    @inject(TOKENS.UserService)
    private readonly userService: IUserService,
  ) {}

  requireAuth: RequestHandler = (req, res, next) => {
    const token = req.cookies?.[this.authService.getCookieName()];
    try {
      const payload = this.authService.verifyAuthToken(token);
      this.userService
        .getActiveUserDtoById(payload.userId)
        .then((user) => {
          const authUser = {
            userId: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
          };
          res.locals.authUser = authUser;
          req.user = user;
          next();
        })
        .catch(() => {
          res.clearCookie(
            this.authService.getCookieName(),
            this.authService.getClearCookieOptions(),
          );
          next(new HttpError(401, 'Your session is no longer active. Contact Admin.'));
        });
    } catch (error) {
      res.clearCookie(
        this.authService.getCookieName(),
        this.authService.getClearCookieOptions(),
      );
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
