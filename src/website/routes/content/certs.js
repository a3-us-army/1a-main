import { Router } from 'express';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import ensureAuth from '../../middleware/ensureAuth.js';
import {
  isUserAdmin,
  getUserRoles,
  getAvailableMOSRoles,
  getAvailableMOSRoleNames,
} from '../../utils/discord.js';
import { getDatabase } from '../../../bot/utils/database.js';
const router = Router();

const db = getDatabase();

router.get('/', ensureAuth, async (req, res) => {
  const isAdmin = await isUserAdmin(req.user.id);
  let certs = [];

  if (isAdmin) {
    // Admins see all certifications
    certs = db.prepare('SELECT * FROM certifications ORDER BY name ASC').all();
  } else {
    // Regular users only see certifications they have access to
    const userRoles = await getUserRoles(req.user.id);
    const userRoleIds = userRoles.map(role => role.id);
    const userRoleNames = userRoles.map(role => role.name);

    certs = db
      .prepare('SELECT * FROM certifications ORDER BY name ASC')
      .all()
      .filter(cert => {
        if (!cert.required_mos) return true;

        // Check if user has the required MOS by ID or name
        const mosRole = getAvailableMOSRoles().find(
          mos => mos.name === cert.required_mos
        );
        if (mosRole) {
          return (
            userRoleIds.includes(mosRole.id) ||
            userRoleNames.includes(cert.required_mos)
          );
        }

        return userRoleNames.includes(cert.required_mos);
      });
  }

  let userRequests = [];
  if (req.user) {
    userRequests = db
      .prepare('SELECT * FROM certification_requests WHERE user_id = ?')
      .all(req.user.id);
  }

  res.render('content/certs', {
    user: req.user,
    certs,
    userRequests,
    alert: req.query.alert,
    error: req.query.error,
    isAdmin,
    active: 'dashboard',
  });
});

router.get('/new', ensureAdmin, async (req, res) => {
  const availableRoles = getAvailableMOSRoleNames();
  res.render('forms/cert_form', {
    user: req.user,
    cert: null,
    action: 'Create',
    isAdmin: true,
    active: 'dashboard',
    alert: req.query.alert || '',
    error: req.query.error || '',
    certs: [],
    availableRoles,
  });
});

router.get('/edit/:id', ensureAdmin, async (req, res) => {
  const cert = db
    .prepare('SELECT * FROM certifications WHERE id = ?')
    .get(req.params.id);
  if (!cert) return res.redirect('/certs?error=Certification not found');

  const availableRoles = getAvailableMOSRoleNames();
  res.render('forms/cert_form', {
    user: req.user,
    cert,
    action: 'Edit',
    isAdmin: true,
    active: 'dashboard',
    alert: req.query.alert || '',
    error: req.query.error || '',
    certs: [],
    availableRoles,
  });
});

router.post('/new', ensureAdmin, (req, res) => {
  const { name, description, required_mos, category } = req.body;
  if (!name) return res.redirect('/certs?error=Name required');
  if (!category) return res.redirect('/certs?error=Category required');
  if (
    !required_mos ||
    (Array.isArray(required_mos) && required_mos.length === 0)
  )
    return res.redirect('/certs?error=Required MOS is required');

  const id = Date.now().toString();
  // Handle both single value and array of values
  const mosValue = Array.isArray(required_mos)
    ? JSON.stringify(required_mos)
    : required_mos;
  db.prepare(
    'INSERT INTO certifications (id, name, description, required_mos, category) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, description, mosValue, category);
  res.redirect('/certs?alert=Certification created!');
});

router.post('/edit/:id', ensureAdmin, (req, res) => {
  const { name, description, required_mos, category } = req.body;
  if (!name) return res.redirect('/certs?error=Name required');
  if (!category) return res.redirect('/certs?error=Category required');
  if (
    !required_mos ||
    (Array.isArray(required_mos) && required_mos.length === 0)
  )
    return res.redirect('/certs?error=Required MOS is required');

  // Handle both single value and array of values
  const mosValue = Array.isArray(required_mos)
    ? JSON.stringify(required_mos)
    : required_mos;
  db.prepare(
    'UPDATE certifications SET name = ?, description = ?, required_mos = ?, category = ? WHERE id = ?'
  ).run(name, description, mosValue, category, req.params.id);
  res.redirect('/certs?alert=Certification updated!');
});

router.post('/delete/:id', ensureAdmin, (req, res) => {
  const certId = req.params.id;
  try {
    // Delete all requests for this cert first
    db.prepare('DELETE FROM certification_requests WHERE cert_id = ?').run(
      certId
    );
    // Then delete the cert itself
    db.prepare('DELETE FROM certifications WHERE id = ?').run(certId);
    res.redirect('/certs?alert=Certification deleted!');
  } catch (err) {
    console.error('Error deleting certification:', err);
    res.redirect('/certs?error=Failed to delete certification.');
  }
});



// API endpoint for requesting certifications
router.post('/api/request-cert', ensureAuth, async (req, res) => {
  try {
    const { certId, certName } = req.body;
    const userId = req.user.id;

    if (!certId) {
      return res.status(400).json({ error: 'Certification ID is required' });
    }

    // Get the certification
    const cert = db.prepare('SELECT * FROM certifications WHERE id = ?').get(certId);
    if (!cert) {
      return res.status(404).json({ error: 'Certification not found' });
    }

    // Check if user has required MOS roles
    if (cert.required_mos) {
      const userRoles = await getUserRoles(userId);
      const userRoleIds = userRoles.map(role => role.id);
      const userRoleNames = userRoles.map(role => role.name);

      let requiredMosArray = [];
      try {
        requiredMosArray = JSON.parse(cert.required_mos);
      } catch (e) {
        requiredMosArray = [cert.required_mos];
      }

      let hasAccess = false;
      for (const requiredMos of requiredMosArray) {
        const mosRole = getAvailableMOSRoles().find(mos => mos.name === requiredMos);
        if (mosRole) {
          if (userRoleIds.includes(mosRole.id) || userRoleNames.includes(requiredMos)) {
            hasAccess = true;
            break;
          }
        } else if (userRoleNames.includes(requiredMos)) {
          hasAccess = true;
          break;
        }
      }

      if (!hasAccess) {
        const mosList = requiredMosArray.join(' or ');
        return res.status(403).json({ 
          error: `You need one of the following roles to request this certification: ${mosList}` 
        });
      }
    }

    // Check if user already has a pending or approved request
    const existing = db
      .prepare(
        "SELECT * FROM certification_requests WHERE user_id = ? AND cert_id = ? AND status IN ('pending', 'approved')"
      )
      .get(userId, certId);

    if (existing) {
      return res.status(409).json({ 
        error: 'You already have a pending or approved request for this certification' 
      });
    }

    // Create the request
    const requestId = Date.now().toString();
    db.prepare(
      'INSERT INTO certification_requests (id, user_id, cert_id, requested_at) VALUES (?, ?, ?, ?)'
    ).run(requestId, userId, certId, new Date().toISOString());

    // Post to Discord bot API
    try {
      await fetch(
        process.env.BOT_API_URL.replace(/\/api\/post-event$/, '/api/request-cert'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
          },
          body: JSON.stringify({
            userId,
            cert,
            requestId,
          }),
        }
      );
    } catch (err) {
      console.error('Failed to post cert request to Discord:', err);
      // Don't fail the request if Discord posting fails
    }

    res.json({ success: true, message: 'Certification requested successfully' });
  } catch (error) {
    console.error('Error requesting certification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/my-certs', ensureAuth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = await isUserAdmin(req.user.id);

  let certs = [];
  if (isAdmin) {
    // Admins see all certifications
    certs = db.prepare('SELECT * FROM certifications ORDER BY name ASC').all();
  } else {
    // Regular users only see certifications they have access to
    const userRoles = await getUserRoles(req.user.id);
    const userRoleIds = userRoles.map(role => role.id);
    const userRoleNames = userRoles.map(role => role.name);

    certs = db
      .prepare('SELECT * FROM certifications ORDER BY name ASC')
      .all()
      .filter(cert => {
        if (!cert.required_mos) return true;

        // Check if user has any of the required MOS by ID or name
        let requiredMosArray = [];
        try {
          // Try to parse as JSON array first
          requiredMosArray = JSON.parse(cert.required_mos);
        } catch (e) {
          // If not JSON, treat as single value
          requiredMosArray = [cert.required_mos];
        }

        // Check if user has any of the required MOS roles
        for (const requiredMos of requiredMosArray) {
          const mosRole = getAvailableMOSRoles().find(
            mos => mos.name === requiredMos
          );
          if (mosRole) {
            if (
              userRoleIds.includes(mosRole.id) ||
              userRoleNames.includes(requiredMos)
            ) {
              return true;
            }
          } else if (userRoleNames.includes(requiredMos)) {
            return true;
          }
        }

        return false;
      });
  }

  const requests = db
    .prepare(
      `SELECT cr.*, c.name AS cert_name, c.description AS cert_description
		 FROM certification_requests cr
		 JOIN certifications c ON cr.cert_id = c.id
		 WHERE cr.user_id = ?
		 ORDER BY cr.requested_at DESC`
    )
    .all(userId);
  res.render('user/my_certs', {
    user: req.user,
    certs,
    requests,
    active: 'my-certs',
  });
});

export default router;
