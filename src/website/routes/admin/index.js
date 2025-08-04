import { Router } from 'express';
import galleryAdminRoutes from './gallery-admin.js';
import applicationRoutes from './application.js';
import vpsStatusRoutes from './vps-status.js';
import equipmentRoutes from './equipment.js';

const router = Router();

router.use('/gallery-admin', galleryAdminRoutes);
router.use('/apply', applicationRoutes);
router.use('/vps-status', vpsStatusRoutes);
router.use('/equipment', equipmentRoutes);
export default router; 