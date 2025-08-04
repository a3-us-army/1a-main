import { Router } from 'express';
import authRoutes from './auth.js';
import appealRouter from './appeals.js';
import expiredRoutes from './expired.js';

const router = Router();

router.use('/', authRoutes);
router.use('/appeal', appealRouter);
router.use('/expired', expiredRoutes);

export default router; 