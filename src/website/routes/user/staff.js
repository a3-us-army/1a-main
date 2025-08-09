import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import ensureAuth from '../../middleware/ensureAuth.js';
import {
  getStaffProfileByUserId,
  updateStaffProfileByUserId,
} from '../../../bot/utils/database.js';

const router = Router();

// Multer for staff image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(process.cwd(), 'uploads/staff');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${req.user.id}_${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    if (ok) return cb(null, true);
    return cb(new Error('Only JPG, PNG, WEBP images are allowed'));
  },
});

router.get('/edit', ensureAuth, (req, res) => {
  const profile = getStaffProfileByUserId(req.user.id);
  if (!profile) {
    return res.status(403).render('error', { user: req.user, active: '', title: 'Not Allowed', error: 'You are not listed as staff.' });
  }
  res.render('user/staff-edit', { user: req.user, active: 'staff', profile, alert: req.query.alert, error: req.query.error });
});

router.post('/edit', ensureAuth, upload.single('image'), (req, res) => {
  const profile = getStaffProfileByUserId(req.user.id);
  if (!profile) {
    return res.status(403).render('error', { user: req.user, active: '', title: 'Not Allowed', error: 'You are not listed as staff.' });
  }
  try {
    const { description } = req.body;
    let image_filename;
    if (req.file) {
      // Delete old file if exists
      if (profile.image_filename) {
        const oldPath = path.resolve(process.cwd(), 'uploads/staff', profile.image_filename);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }
      image_filename = req.file.filename;
    }
    updateStaffProfileByUserId(req.user.id, { description, image_filename });
    return res.redirect('/staff/edit?alert=Profile updated');
  } catch (e) {
    console.error('Failed to update staff profile:', e);
    return res.redirect('/staff/edit?error=Failed to update profile');
  }
});

export default router;


