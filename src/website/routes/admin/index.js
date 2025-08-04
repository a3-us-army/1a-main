import { Router } from 'express';
import galleryAdminRoutes from './gallery-admin.js';
import applicationRoutes from './application.js';
import vpsStatusRoutes from './vps-status.js';

const router = Router();

router.use('/gallery-admin', galleryAdminRoutes);
router.use('/apply', applicationRoutes);
router.use('/vps-status', vpsStatusRoutes);

export default router; 