import { Router } from 'express';
import serverStatusRoutes from './server-status.js';

const router = Router();

router.use('/server-status', serverStatusRoutes);

export default router;
