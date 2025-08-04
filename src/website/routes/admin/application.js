import { Router } from 'express';
import ensureAuth from '../../middleware/ensureAuth.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { isUserAdmin, isUserInGuild } from '../../utils/discord.js';
import { getDatabase } from '../../../bot/utils/database.js';
const router = Router();

const db = getDatabase();

router.get('/', ensureAuth, async (req, res) => {
  const existing = db
    .prepare('SELECT 1 FROM applications WHERE user_id = ?')
    .get(req.user.id);
  const isAdmin = await isUserAdmin(req.user.id);

  // Get form configuration
  const formConfig = db
    .prepare(
      'SELECT questions FROM application_config ORDER BY id DESC LIMIT 1'
    )
    .get();
  const questions = formConfig ? JSON.parse(formConfig.questions) : [];

  let allApplications = [];
  if (isAdmin) {
    allApplications = db
      .prepare('SELECT * FROM applications ORDER BY submitted_at DESC')
      .all();
  }

  res.render('forms/apply', {
    user: req.user,
    active: 'application',
    alreadyApplied: !!existing,
    query: req.query,
    isAdmin,
    allApplications,
    questions,
  });
});

router.post('/', ensureAuth, async (req, res) => {
  // Check if user has already applied
  const existing = await db
    .prepare('SELECT 1 FROM applications WHERE user_id = ?')
    .get(req.user.id);
  if (existing) {
    return res.redirect(
      '/apply?error=You have already submitted an application.'
    );
  }

  // Check if user is in the Discord server
  const inGuild = await isUserInGuild(req.user.id);
  if (!inGuild) {
    return res.redirect(
      '/apply?error=You must be a member of our Discord server to apply.'
    );
  }

  // Get form data from request body
  const formData = req.body;

  // Save to DB
  try {
    // Send to bot API for Discord posting
    const response = await fetch(
      process.env.BOT_API_URL.replace(
        /\/api\/post-event$/,
        '/api/post-application'
      ),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
        },
        body: JSON.stringify({
          application: {
            userId: req.user.id,
            username: req.user.username,
            foundUnit: formData.foundUnit,
            steam64: formData.steam64,
            discordUsername: req.user.username,
            unitName: formData.unitName,
            age: formData.age,
            experience: formData.experience || '',
            mos: formData.mos,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('Discord API error:', response.status, text);
      throw new Error('Failed to post application to Discord');
    }

    res.redirect(
      '/apply?alert=Application submitted! We will contact you soon.'
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      '/apply?error=Failed to submit application. Please try again.'
    );
  }
});

// Admin: Edit application form
router.get('/admin/edit', ensureAuth, ensureAdmin, (req, res) => {
  const formConfig = db
    .prepare(
      'SELECT questions FROM application_config ORDER BY id DESC LIMIT 1'
    )
    .get();
  const questions = formConfig ? JSON.parse(formConfig.questions) : [];

  res.render('admin/apply_admin_edit', {
    user: req.user,
    active: 'application',
    questions,
    query: req.query,
  });
});

// Admin: Save application form changes
router.post('/admin/edit', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const { questions } = req.body;

    // Parse and validate the questions JSON
    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(questions);

      // Basic validation
      if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
        throw new Error('Questions must be a non-empty array');
      }

      // Validate each question has required fields
      parsedQuestions.forEach(q => {
        if (!q.id || !q.label || !q.type) {
          throw new Error('Each question must have id, label, and type');
        }
      });
    } catch (err) {
      return res.redirect(
        `/apply/admin/edit?error=Invalid form configuration: ${err.message}`
      );
    }

    // Save to database
    db.prepare(
      `
      INSERT INTO application_config (questions, updated_by)
      VALUES (?, ?)
    `
    ).run(questions, req.user.id);

    res.redirect(
      '/apply/admin/edit?alert=Form configuration saved successfully'
    );
  } catch (err) {
    console.error('Error saving form configuration:', err);
    res.redirect('/apply/admin/edit?error=Failed to save form configuration');
  }
});

// Admin: View individual application
router.get('/admin/view/:id', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const application = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.id);

    if (!application) {
      return res.redirect('/apply?error=Application not found');
    }

    // Get form configuration to display questions properly
    const formConfig = db
      .prepare(
        'SELECT questions FROM application_config ORDER BY id DESC LIMIT 1'
      )
      .get();
    const questions = formConfig ? JSON.parse(formConfig.questions) : [];

    res.render('admin/apply_admin_view', {
      user: req.user,
      active: 'application',
      application,
      questions,
      query: req.query,
    });
  } catch (err) {
    console.error('Error viewing application:', err);
    res.redirect('/apply?error=Failed to load application');
  }
});

// Admin: Edit individual application
router.get('/admin/edit/:id', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const application = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.id);

    if (!application) {
      return res.redirect('/apply?error=Application not found');
    }

    // Get form configuration
    const formConfig = db
      .prepare(
        'SELECT questions FROM application_config ORDER BY id DESC LIMIT 1'
      )
      .get();
    const questions = formConfig ? JSON.parse(formConfig.questions) : [];

    res.render('admin/apply_admin_edit_application', {
      user: req.user,
      active: 'application',
      application,
      questions,
      query: req.query,
    });
  } catch (err) {
    console.error('Error loading application for edit:', err);
    res.redirect('/apply?error=Failed to load application');
  }
});

// Admin: Update individual application
router.post('/admin/edit/:id', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const { status, notes } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'approved', 'denied'];
    if (!validStatuses.includes(status)) {
      return res.redirect(`/apply/admin/edit/${req.params.id}?error=Invalid status`);
    }

    // Update application
    db.prepare(`
      UPDATE applications 
      SET status = ?, notes = ?, updated_at = DATETIME('now'), updated_by = ?
      WHERE id = ?
    `).run(status, notes || null, req.user.id, req.params.id);

    res.redirect(`/apply/admin/edit/${req.params.id}?alert=Application updated successfully`);
  } catch (err) {
    console.error('Error updating application:', err);
    res.redirect(`/apply/admin/edit/${req.params.id}?error=Failed to update application`);
  }
});

// Admin: Delete individual application
router.delete('/admin/delete/:id', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const application = db
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    // Delete the application
    db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (err) {
    console.error('Error deleting application:', err);
    res.status(500).json({ success: false, error: 'Failed to delete application' });
  }
});

// Admin: Bulk actions
router.post('/admin/bulk-action', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const { action, applicationIds } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No applications selected' });
    }

    switch (action) {
      case 'approve':
        db.prepare(`
          UPDATE applications 
          SET status = 'approved', updated_at = DATETIME('now'), updated_by = ?
          WHERE id IN (${applicationIds.map(() => '?').join(',')})
        `).run(req.user.id, ...applicationIds);
        break;
      
      case 'deny':
        db.prepare(`
          UPDATE applications 
          SET status = 'denied', updated_at = DATETIME('now'), updated_by = ?
          WHERE id IN (${applicationIds.map(() => '?').join(',')})
        `).run(req.user.id, ...applicationIds);
        break;
      
      case 'delete':
        db.prepare(`
          DELETE FROM applications 
          WHERE id IN (${applicationIds.map(() => '?').join(',')})
        `).run(...applicationIds);
        break;
      
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    res.json({ success: true, message: `Bulk action '${action}' completed successfully` });
  } catch (err) {
    console.error('Error performing bulk action:', err);
    res.status(500).json({ success: false, error: 'Failed to perform bulk action' });
  }
});

export default router;
