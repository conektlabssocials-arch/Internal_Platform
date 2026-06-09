import 'reflect-metadata';
import { container } from 'tsyringe';

import { AuthService } from '../services/auth.service.js';
import type { IAuthService } from '../services/auth.service.js';
import { ActivityService } from '../services/activity.service.js';
import type { IActivityService } from '../services/activity.service.js';
import { CampaignCounterRepository } from '../repositories/campaignCounter.repository.js';
import type { ICampaignCounterRepository } from '../repositories/campaignCounter.repository.js';
import { CampaignRepository } from '../repositories/campaign.repository.js';
import type { ICampaignRepository } from '../repositories/campaign.repository.js';
import { CampaignService } from '../services/campaign.service.js';
import type { ICampaignService } from '../services/campaign.service.js';
import { CampaignCommandService } from '../services/campaignCommand.service.js';
import type { ICampaignCommandService } from '../services/campaignCommand.service.js';
import { ContactRepository } from '../repositories/contact.repository.js';
import type { IContactRepository } from '../repositories/contact.repository.js';
import { CrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import { CrmService } from '../services/crm.service.js';
import type { ICrmService } from '../services/crm.service.js';
import { DashboardService } from '../services/dashboard.service.js';
import type { IDashboardService } from '../services/dashboard.service.js';
import { DocumentRepository } from '../repositories/document.repository.js';
import type { IDocumentRepository } from '../repositories/document.repository.js';
import { DocumentService } from '../services/document.service.js';
import type { IDocumentService } from '../services/document.service.js';
import { DocumentCommandService } from '../services/documentCommand.service.js';
import type { IDocumentCommandService } from '../services/documentCommand.service.js';
import { GeocodingService } from '../services/geocoding.service.js';
import type { IGeocodingService } from '../services/geocoding.service.js';
import { InventoryCounterRepository } from '../repositories/inventoryCounter.repository.js';
import type { IInventoryCounterRepository } from '../repositories/inventoryCounter.repository.js';
import { InventoryRepository } from '../repositories/inventory.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import { InventoryService } from '../services/inventory.service.js';
import type { IInventoryService } from '../services/inventory.service.js';
import { OperationCounterRepository } from '../repositories/operationCounter.repository.js';
import type { IOperationCounterRepository } from '../repositories/operationCounter.repository.js';
import { OperationRepository } from '../repositories/operation.repository.js';
import type { IOperationRepository } from '../repositories/operation.repository.js';
import { OperationService } from '../services/operation.service.js';
import type { IOperationService } from '../services/operation.service.js';
import { OperationCommandService } from '../services/operationCommand.service.js';
import type { IOperationCommandService } from '../services/operationCommand.service.js';
import { PlanRepository } from '../repositories/plan.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import { PlanService } from '../services/plan.service.js';
import type { IPlanService } from '../services/plan.service.js';
import { PlanCommandService } from '../services/planCommand.service.js';
import type { IPlanCommandService } from '../services/planCommand.service.js';
import { PlanAuthoringCommandService } from '../services/planAuthoringCommand.service.js';
import type { IPlanAuthoringCommandService } from '../services/planAuthoringCommand.service.js';
import { PdfService } from '../services/pdf.service.js';
import { ShareRepository } from '../repositories/share.repository.js';
import type { IShareRepository } from '../repositories/share.repository.js';
import { ShareService } from '../services/share.service.js';
import type { IShareService } from '../services/share.service.js';
import { ShareCommandService } from '../services/shareCommand.service.js';
import type { IShareCommandService } from '../services/shareCommand.service.js';
import { UploadService } from '../services/upload.service.js';
import type { IUploadService } from '../services/upload.service.js';
import { ProofUploadCommandService } from '../services/proofUploadCommand.service.js';
import type { IProofUploadCommandService } from '../services/proofUploadCommand.service.js';
import { TOKENS } from './tokens.js';
import { UserService } from '../services/user.service.js';
import type { IUserService } from '../services/user.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { IUserRepository } from '../repositories/user.repository.js';

container.registerSingleton<IUserRepository>(TOKENS.UserRepository, UserRepository);
container.registerSingleton<IActivityService>(TOKENS.ActivityService, ActivityService);
container.registerSingleton<IUserService>(TOKENS.UserService, UserService);
container.registerSingleton<IAuthService>(TOKENS.AuthService, AuthService);
container.registerSingleton<ICampaignCounterRepository>(
  TOKENS.CampaignCounterRepository,
  CampaignCounterRepository,
);
container.registerSingleton<ICampaignRepository>(TOKENS.CampaignRepository, CampaignRepository);
container.registerSingleton<ICampaignService>(TOKENS.CampaignService, CampaignService);
container.registerSingleton<ICampaignCommandService>(
  TOKENS.CampaignCommandService,
  CampaignCommandService,
);
container.registerSingleton<IContactRepository>(TOKENS.ContactRepository, ContactRepository);
container.registerSingleton<ICrmEntityRepository>(
  TOKENS.CrmEntityRepository,
  CrmEntityRepository,
);
container.registerSingleton<ICrmService>(TOKENS.CrmService, CrmService);
container.registerSingleton<IDashboardService>(TOKENS.DashboardService, DashboardService);
container.registerSingleton<IDocumentRepository>(
  TOKENS.DocumentRepository,
  DocumentRepository,
);
container.registerSingleton<IDocumentService>(TOKENS.DocumentService, DocumentService);
container.registerSingleton<IDocumentCommandService>(
  TOKENS.DocumentCommandService,
  DocumentCommandService,
);
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
container.registerSingleton<IOperationCounterRepository>(
  TOKENS.OperationCounterRepository,
  OperationCounterRepository,
);
container.registerSingleton<IOperationRepository>(
  TOKENS.OperationRepository,
  OperationRepository,
);
container.registerSingleton<IOperationService>(TOKENS.OperationService, OperationService);
container.registerSingleton<IOperationCommandService>(
  TOKENS.OperationCommandService,
  OperationCommandService,
);
container.registerSingleton<IPlanRepository>(TOKENS.PlanRepository, PlanRepository);
container.registerSingleton<IPlanService>(TOKENS.PlanService, PlanService);
container.registerSingleton<IPlanCommandService>(
  TOKENS.PlanCommandService,
  PlanCommandService,
);
container.registerSingleton<IPlanAuthoringCommandService>(
  TOKENS.PlanAuthoringCommandService,
  PlanAuthoringCommandService,
);
container.registerSingleton<IProofUploadCommandService>(
  TOKENS.ProofUploadCommandService,
  ProofUploadCommandService,
);
container.registerSingleton<PdfService>(TOKENS.PdfService, PdfService);
container.registerSingleton<IShareRepository>(TOKENS.ShareRepository, ShareRepository);
container.registerSingleton<IShareService>(TOKENS.ShareService, ShareService);
container.registerSingleton<IShareCommandService>(
  TOKENS.ShareCommandService,
  ShareCommandService,
);
container.registerSingleton<IUploadService>(TOKENS.UploadService, UploadService);

export { container };
