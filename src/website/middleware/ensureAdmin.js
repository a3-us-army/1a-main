import { isUserAdmin } from '../utils/discord.js';

export default async function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated() || !req.user) {
    return res.redirect('/login');
  }
  const isAdmin = await isUserAdmin(req.user.id);
  if (isAdmin) return next();
  return res.status(403).render('error', {
    user: req.user,
    error: 'You do not have permission to access this page.',
    active: '',
  });
}
