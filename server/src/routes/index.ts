import { Router } from 'express';

import authRoutes from './auth.routes.js';
import activityRoutes from './activity.routes.js';
import campaignRoutes from './campaign.routes.js';
import crmRoutes from './crm.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import documentRoutes from './document.routes.js';
import geocodeRoutes from './geocode.routes.js';
import importRoutes from './import.routes.js';
import inventoryRoutes from './inventory.routes.js';
import operationRoutes from './operation.routes.js';
import planRoutes from './plan.routes.js';
import platformSettingsRoutes from './platformSettings.routes.js';
import publicShareRoutes from './publicShare.routes.js';
import publicDriveImageRoutes from './publicDriveImage.routes.js';
import publicUploadRoutes from './publicUpload.routes.js';
import shareRoutes from './share.routes.js';
import uploadRoutes from './upload.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/activity', activityRoutes);
router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/crm', crmRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/documents', documentRoutes);
router.use('/geocode', geocodeRoutes);
router.use('/imports', importRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/operations', operationRoutes);
router.use('/plans', planRoutes);
router.use('/platform-settings', platformSettingsRoutes);
router.use('/public/shares', publicShareRoutes);
router.use('/public/drive-images', publicDriveImageRoutes);
router.use('/public/uploads', publicUploadRoutes);
router.use('/shares', shareRoutes);
router.use('/uploads', uploadRoutes);
router.use('/users', userRoutes);

export default router;
