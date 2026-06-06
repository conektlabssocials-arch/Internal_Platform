import { Router } from 'express';

import { container } from '../config/container.js';
import { CrmController } from '../controllers/crm.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const crmController = container.resolve(CrmController);
const authMiddleware = container.resolve(AuthMiddleware);

router.use(authMiddleware.requireAuth);

router.get('/suppliers/search', asyncHandler(crmController.searchSuppliers));
router.get('/summary', asyncHandler(crmController.getSummary));
router.get('/entities', asyncHandler(crmController.getEntities));
router.get('/entities/:id', asyncHandler(crmController.getEntity));
router.post('/entities', asyncHandler(crmController.postEntity));
router.patch('/entities/:id', asyncHandler(crmController.patchEntity));
router.patch(
  '/entities/:id/deactivate',
  authMiddleware.requireAdmin,
  asyncHandler(crmController.deactivateEntity),
);
router.patch(
  '/entities/:id/activate',
  authMiddleware.requireAdmin,
  asyncHandler(crmController.activateEntity),
);
router.get('/entities/:entityId/contacts', asyncHandler(crmController.getContacts));
router.post('/entities/:entityId/contacts', asyncHandler(crmController.postContact));
router.patch('/contacts/:contactId', asyncHandler(crmController.patchContact));
router.patch(
  '/contacts/:contactId/deactivate',
  asyncHandler(crmController.deactivateContact),
);
router.patch('/contacts/:contactId/activate', asyncHandler(crmController.activateContact));
router.delete('/contacts/:contactId', asyncHandler(crmController.deleteContact));

export default router;
