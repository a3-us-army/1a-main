import { Router } from 'express';
import authRoutes from './auth/index.js';
import adminRoutes from './admin/index.js';
import userRoutes from './user/index.js';
import contentRoutes from './content/index.js';
import statusRoutes from './status/index.js';

const router = Router();

router.use('/', authRoutes);
router.use('/', adminRoutes);
router.use('/', userRoutes);
router.use('/', contentRoutes);
router.use('/', statusRoutes);

export default router;
