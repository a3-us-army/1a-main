import { Router } from 'express';
import homeRoutes from './home.js';
import eventsRoutes from './events.js';
import certsRoutes from './certs.js';
import personnelRoutes from './personnel.js';
import loaRoutes from './loa.js';
import modpacksRouter from './modpack.js';
import formsRoutes from './forms.js';
import documentsRoutes from './documents.js';
import staffRoutes from './staff.js';

const router = Router();

router.use('/', homeRoutes);
router.use('/events', eventsRoutes);
router.use('/certs', certsRoutes);
router.use('/personnel', personnelRoutes);
router.use('/loa', loaRoutes);
router.use('/modpacks', modpacksRouter);
router.use('/forms', formsRoutes);
router.use('/documents', documentsRoutes);
router.use('/staff', staffRoutes);

export default router; 