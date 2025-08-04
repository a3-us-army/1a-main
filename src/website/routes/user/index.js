import { Router } from 'express';
import profileRoutes from './profile.js';
import userRoutes from './user.js';
import myCertRoutes from './my-certs.js';

const router = Router();

router.use('/profile', profileRoutes);
router.use('/user-info', userRoutes);
router.use('/my-certs', myCertRoutes);

export default router; 