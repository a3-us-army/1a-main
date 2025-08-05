import { Router } from 'express';
import galleryAdminRoutes from './gallery-admin.js';
import applicationRoutes from './application.js';
import vpsStatusRoutes from './vps-status.js';
import equipmentRoutes from './equipment.js';
import databaseRoutes from './database.js';
import databaseEditorRoutes from './database-editor.js';
import formsRoutes from './forms.js';

const router = Router();

router.use('/gallery-admin', galleryAdminRoutes);
router.use('/apply', applicationRoutes);
router.use('/vps-status', vpsStatusRoutes);
router.use('/equipment', equipmentRoutes);
router.use('/database-health', databaseRoutes);
router.use('/database-editor', databaseEditorRoutes);
router.use('/form-builder', formsRoutes);
export default router; 