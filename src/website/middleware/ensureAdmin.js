import { isUserWebAdmin } from '../utils/discord.js';

export default async function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated() || !req.user) {
    return res.redirect('/login');
  }
  const isWebAdmin = await isUserWebAdmin(req.user.id);
  if (isWebAdmin) return next();
  return res.status(403).render('error', {
    user: req.user,
    error: 'You do not have permission to access this page. Web Admin role required.',
    active: '',
  });
}
