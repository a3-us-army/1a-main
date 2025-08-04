import { Router } from 'express';
import galleryAdminRoutes from './gallery-admin.js';
import applicationRoutes from './application.js';

const router = Router();

router.use('/gallery-admin', galleryAdminRoutes);
router.use('/apply', applicationRoutes);

export default router; 