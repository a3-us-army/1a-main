import { Router } from 'express';
import botStatusRoutes from './botstatus.js';

const router = Router();

router.use('/botstatus', botStatusRoutes);

export default router; 