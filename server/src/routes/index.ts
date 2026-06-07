import { Router } from 'express';

import authRoutes from './auth.routes.js';
import campaignRoutes from './campaign.routes.js';
import crmRoutes from './crm.routes.js';
import documentRoutes from './document.routes.js';
import geocodeRoutes from './geocode.routes.js';
import inventoryRoutes from './inventory.routes.js';
import operationRoutes from './operation.routes.js';
import planRoutes from './plan.routes.js';
import publicShareRoutes from './publicShare.routes.js';
import shareRoutes from './share.routes.js';
import uploadRoutes from './upload.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/crm', crmRoutes);
router.use('/documents', documentRoutes);
router.use('/geocode', geocodeRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/operations', operationRoutes);
router.use('/plans', planRoutes);
router.use('/public/shares', publicShareRoutes);
router.use('/shares', shareRoutes);
router.use('/uploads', uploadRoutes);
router.use('/users', userRoutes);

export default router;
