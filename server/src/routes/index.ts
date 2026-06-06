import { Router } from 'express';

import authRoutes from './auth.routes.js';
import campaignRoutes from './campaign.routes.js';
import crmRoutes from './crm.routes.js';
import geocodeRoutes from './geocode.routes.js';
import inventoryRoutes from './inventory.routes.js';
import planRoutes from './plan.routes.js';
import uploadRoutes from './upload.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/crm', crmRoutes);
router.use('/geocode', geocodeRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/plans', planRoutes);
router.use('/uploads', uploadRoutes);
router.use('/users', userRoutes);

export default router;
