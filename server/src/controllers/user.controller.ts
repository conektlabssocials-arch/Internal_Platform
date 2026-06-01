import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IUserService } from '../services/user.service.js';
import type { UserRole, UserStatus } from '../models/user.model.js';
import { HttpError } from '../utils/httpError.js';

type AuthLocals = {
  authUser?: {
    userId: string;
    email: string;
    role: UserRole;
  };
};

const getAuthUserId = (locals: AuthLocals) => {
  if (!locals.authUser) {
    throw new HttpError(401, 'Authentication required');
  }

  return locals.authUser.userId;
};

@injectable()
export class UserController {
  constructor(
    @inject(TOKENS.UserService)
    private readonly userService: IUserService,
  ) {}

  getUsers = async (_req: Request, res: Response) => {
    const users = await this.userService.listUsers();
    res.status(200).json({ users });
  };

  postUser = async (req: Request, res: Response) => {
    const authUserId = getAuthUserId(res.locals);
    const user = await this.userService.createUser({
      name: req.body.name,
      email: req.body.email,
      role: req.body.role,
      createdBy: authUserId,
    });

    res.status(201).json({ user });
  };

  patchUser = async (req: Request, res: Response) => {
    const authUserId = getAuthUserId(res.locals);
    const user = await this.userService.updateUser(req.params.id, {
      name: req.body.name,
      email: req.body.email,
      role: req.body.role as UserRole | undefined,
      status: req.body.status as UserStatus | undefined,
      updatedBy: authUserId,
    });

    res.status(200).json({ user });
  };

  deactivateUser = async (req: Request, res: Response) => {
    const authUserId = getAuthUserId(res.locals);
    const user = await this.userService.setUserStatus(req.params.id, 'inactive', authUserId);

    res.status(200).json({ user });
  };

  activateUser = async (req: Request, res: Response) => {
    const authUserId = getAuthUserId(res.locals);
    const user = await this.userService.setUserStatus(req.params.id, 'active', authUserId);

    res.status(200).json({ user });
  };
}
