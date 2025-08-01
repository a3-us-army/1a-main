import { Router } from 'express';
import { getDatabase } from '../../bot/utils/database.js';

const router = Router();
const db = getDatabase();

router.get('/', (req, res) => {
  res.render('home', {
    user: req.user,
    active: 'home',
  });
});

router.get('/dashboard', (req, res) => {
  res.render('dashboard', {
    user: req.user,
    active: 'dashboard',
  });
});

router.get('/about', (req, res) => {
  // Get gallery images for the about page
  const galleryImages = db.prepare('SELECT * FROM gallery_images ORDER BY display_order ASC').all();
  
  res.render('about', {
    user: req.user,
    active: 'about',
    galleryImages: galleryImages
  });
});

router.get('/tos', (req, res) => {
  res.render('tos', { user: req.user, active: '' });
});

router.get('/privacy', (req, res) => {
  res.render('privacy', { user: req.user, active: '' });
});

export default router;
