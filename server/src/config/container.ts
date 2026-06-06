import 'reflect-metadata';
import { container } from 'tsyringe';

import { AuthService } from '../services/auth.service.js';
import type { IAuthService } from '../services/auth.service.js';
import { CampaignCounterRepository } from '../repositories/campaignCounter.repository.js';
import type { ICampaignCounterRepository } from '../repositories/campaignCounter.repository.js';
import { CampaignRepository } from '../repositories/campaign.repository.js';
import type { ICampaignRepository } from '../repositories/campaign.repository.js';
import { CampaignService } from '../services/campaign.service.js';
import type { ICampaignService } from '../services/campaign.service.js';
import { ContactRepository } from '../repositories/contact.repository.js';
import type { IContactRepository } from '../repositories/contact.repository.js';
import { CrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import { CrmService } from '../services/crm.service.js';
import type { ICrmService } from '../services/crm.service.js';
import { GeocodingService } from '../services/geocoding.service.js';
import type { IGeocodingService } from '../services/geocoding.service.js';
import { InventoryCounterRepository } from '../repositories/inventoryCounter.repository.js';
import type { IInventoryCounterRepository } from '../repositories/inventoryCounter.repository.js';
import { InventoryRepository } from '../repositories/inventory.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import { InventoryService } from '../services/inventory.service.js';
import type { IInventoryService } from '../services/inventory.service.js';
import { PlanRepository } from '../repositories/plan.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import { PlanService } from '../services/plan.service.js';
import type { IPlanService } from '../services/plan.service.js';
import { UploadService } from '../services/upload.service.js';
import type { IUploadService } from '../services/upload.service.js';
import { TOKENS } from './tokens.js';
import { UserService } from '../services/user.service.js';
import type { IUserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { IUserRepository } from '../repositories/user.repository.js';

container.registerSingleton<IUserRepository>(TOKENS.UserRepository, UserRepository);
container.registerSingleton<IUserService>(TOKENS.UserService, UserService);
container.registerSingleton<IAuthService>(TOKENS.AuthService, AuthService);
container.registerSingleton<ICampaignCounterRepository>(
  TOKENS.CampaignCounterRepository,
  CampaignCounterRepository,
);
container.registerSingleton<ICampaignRepository>(TOKENS.CampaignRepository, CampaignRepository);
container.registerSingleton<ICampaignService>(TOKENS.CampaignService, CampaignService);
container.registerSingleton<IContactRepository>(TOKENS.ContactRepository, ContactRepository);
container.registerSingleton<ICrmEntityRepository>(
  TOKENS.CrmEntityRepository,
  CrmEntityRepository,
);
container.registerSingleton<ICrmService>(TOKENS.CrmService, CrmService);
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
container.registerSingleton<IPlanRepository>(TOKENS.PlanRepository, PlanRepository);
container.registerSingleton<IPlanService>(TOKENS.PlanService, PlanService);
container.registerSingleton<IUploadService>(TOKENS.UploadService, UploadService);

export { container };
