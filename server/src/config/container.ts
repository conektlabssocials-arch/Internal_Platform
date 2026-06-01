import 'reflect-metadata';
import { container } from 'tsyringe';

import { AuthService } from '../services/auth.service.js';
import type { IAuthService } from '../services/auth.service.js';
import { TOKENS } from './tokens.js';
import { UserService } from '../services/user.service.js';
import type { IUserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { IUserRepository } from '../repositories/user.repository.js';

container.registerSingleton<IUserRepository>(TOKENS.UserRepository, UserRepository);
container.registerSingleton<IUserService>(TOKENS.UserService, UserService);
container.registerSingleton<IAuthService>(TOKENS.AuthService, AuthService);

export { container };
