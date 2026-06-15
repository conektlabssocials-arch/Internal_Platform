import { Router } from 'express';

import { container } from '../config/container.js';
import { ImportController } from '../controllers/import.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { importCsvUpload } from '../middleware/importUpload.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(ImportController);
const auth = container.resolve(AuthMiddleware);

router.use(auth.requireAuth, auth.requireAdmin);
router.get('/templates', asyncHandler(controller.listTemplates));
router.get('/templates/:templateName/download', asyncHandler(controller.downloadTemplate));
router.get('/jobs', asyncHandler(controller.listJobs));
router.get('/jobs/:jobId/errors.csv', asyncHandler(controller.downloadErrors));
router.get('/jobs/:jobId', asyncHandler(controller.getJob));
router.post('/jobs/:jobId/validate', asyncHandler(controller.validate));
router.post('/jobs/:jobId/commit', asyncHandler(controller.commit));
router.delete('/jobs/:jobId', asyncHandler(controller.cancel));
router.post('/:importType/upload', importCsvUpload, asyncHandler(controller.upload));

export default router;
