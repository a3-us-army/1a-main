import { Router } from 'express';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { v4 as uuidv4 } from 'uuid';
import {
  addStaffProfile,
  getAllStaffProfiles,
  deleteStaffProfileById,
  getStaffProfileById,
  updateStaffProfileById,
  setStaffOrder,
} from '../../../bot/utils/database.js';

const router = Router();

router.get('/', ensureAdmin, (req, res) => {
  const profiles = getAllStaffProfiles();
  res.render('admin/staff-admin', {
    user: req.user,
    active: 'staff-admin',
    profiles,
    alert: req.query.alert,
    error: req.query.error,
  });
});

router.post('/add', ensureAdmin, (req, res) => {
  try {
    const { discord_id, title } = req.body;
    if (!discord_id || !/^\d{5,}$/.test(discord_id)) {
      return res.redirect('/staff-admin?error=Invalid Discord user ID');
    }
    const id = uuidv4();
    addStaffProfile({ id, user_id: discord_id, title: title || null });
    return res.redirect('/staff-admin?alert=Staff member added');
  } catch (e) {
    console.error('Failed to add staff:', e);
    return res.redirect('/staff-admin?error=Failed to add staff member');
  }
});

router.post('/delete/:id', ensureAdmin, (req, res) => {
  try {
    deleteStaffProfileById(req.params.id);
    return res.redirect('/staff-admin?alert=Staff member removed');
  } catch (e) {
    console.error('Failed to delete staff:', e);
    return res.redirect('/staff-admin?error=Failed to remove staff member');
  }
});

router.get('/edit/:id', ensureAdmin, (req, res) => {
  const profile = getStaffProfileById(req.params.id);
  if (!profile) return res.redirect('/staff-admin?error=Profile not found');
  res.render('admin/staff-edit-admin', { user: req.user, active: 'staff-admin', profile });
});

router.post('/edit/:id', ensureAdmin, (req, res) => {
  try {
    const { title, description, is_active } = req.body;
    updateStaffProfileById(req.params.id, {
      title,
      description,
      is_active: is_active === 'on' || is_active === '1',
    });
    return res.redirect('/staff-admin?alert=Staff profile updated');
  } catch (e) {
    console.error('Failed to edit staff profile:', e);
    return res.redirect('/staff-admin?error=Failed to update staff profile');
  }
});

router.post('/reorder', ensureAdmin, (req, res) => {
  try {
    const { order } = req.body; // expect comma-separated IDs or array
    let ids = [];
    if (Array.isArray(order)) ids = order;
    else if (typeof order === 'string') ids = order.split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'Invalid order data' });
    setStaffOrder(ids);
    return res.json({ success: true });
  } catch (e) {
    console.error('Failed to reorder staff:', e);
    return res.status(500).json({ error: 'Failed to save order' });
  }
});

export default router;


