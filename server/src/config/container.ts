import 'reflect-metadata';
import { container } from 'tsyringe';

import { AuthService } from '../services/auth.service.js';
import type { IAuthService } from '../services/auth.service.js';
import { GeocodingService } from '../services/geocoding.service.js';
import type { IGeocodingService } from '../services/geocoding.service.js';
import { InventoryCounterRepository } from '../repositories/inventoryCounter.repository.js';
import type { IInventoryCounterRepository } from '../repositories/inventoryCounter.repository.js';
import { InventoryRepository } from '../repositories/inventory.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import { InventoryService } from '../services/inventory.service.js';
import type { IInventoryService } from '../services/inventory.service.js';
import { TOKENS } from './tokens.js';
import { UserService } from '../services/user.service.js';
import type { IUserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { IUserRepository } from '../repositories/user.repository.js';

container.registerSingleton<IUserRepository>(TOKENS.UserRepository, UserRepository);
container.registerSingleton<IUserService>(TOKENS.UserService, UserService);
container.registerSingleton<IAuthService>(TOKENS.AuthService, AuthService);
container.registerSingleton<IGeocodingService>(TOKENS.GeocodingService, GeocodingService);
container.registerSingleton<IInventoryCounterRepository>(
  TOKENS.InventoryCounterRepository,
  InventoryCounterRepository,
);
container.registerSingleton<IInventoryRepository>(
  TOKENS.InventoryRepository,
  InventoryRepository,
);
container.registerSingleton<IInventoryService>(TOKENS.InventoryService, InventoryService);

export { container };
