import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { IActivityService } from '../services/activity.service.js';
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
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
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
    await this.activity.logEntityActivity({
      actor: res.locals.authUser, action: ACTIVITY_ACTIONS.USER_CREATED, entityType: 'User',
      entityId: user.id, entityTitle: user.name, message: `${user.name} was added as a user.`, req,
    });

    res.status(201).json({ user });
  };

  patchUser = async (req: Request, res: Response) => {
    const authUserId = getAuthUserId(res.locals);
    const before = await this.userService.getUserById(req.params.id);
    const user = await this.userService.updateUser(req.params.id, {
      name: req.body.name,
      email: req.body.email,
      role: req.body.role as UserRole | undefined,
      status: req.body.status as UserStatus | undefined,
      updatedBy: authUserId,
    });
    await this.activity.logEntityActivity({
      actor: res.locals.authUser, action: ACTIVITY_ACTIONS.USER_UPDATED, entityType: 'User',
      entityId: user.id, entityTitle: user.name, message: `${user.name} was updated.`,
      changes: this.activity.buildChangeSet(before.toObject(), user, ['name', 'email', 'role', 'status']), req,
    });

    res.status(200).json({ user });
  };

  deactivateUser = async (req: Request, res: Response) => {
    const authUserId = getAuthUserId(res.locals);
    const user = await this.userService.setUserStatus(req.params.id, 'inactive', authUserId);
    await this.activity.logEntityActivity({
      actor: res.locals.authUser, action: ACTIVITY_ACTIONS.USER_DEACTIVATED, entityType: 'User',
      entityId: user.id, entityTitle: user.name, message: `${user.name} was deactivated.`,
      changes: [{ field: 'status', from: 'active', to: 'inactive' }], req,
    });

    res.status(200).json({ user });
  };

  activateUser = async (req: Request, res: Response) => {
    const authUserId = getAuthUserId(res.locals);
    const user = await this.userService.setUserStatus(req.params.id, 'active', authUserId);
    await this.activity.logEntityActivity({
      actor: res.locals.authUser, action: ACTIVITY_ACTIONS.USER_ACTIVATED, entityType: 'User',
      entityId: user.id, entityTitle: user.name, message: `${user.name} was activated.`,
      changes: [{ field: 'status', from: 'inactive', to: 'active' }], req,
    });

    res.status(200).json({ user });
  };
}
