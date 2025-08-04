import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../../bot/utils/database.js';
import { isUserAdmin } from '../../utils/discord.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import ensureAuth from '../../middleware/ensureAuth.js';

const router = Router();
const db = getDatabase();

// Show all equipment
router.get('/', async (req, res) => {
  const equipment = db
    .prepare('SELECT * FROM equipment ORDER BY category, name')
    .all();
  const events = db.prepare('SELECT * FROM events ORDER BY time DESC').all();
  let isAdmin = false;
  if (req.user) {
    isAdmin = await isUserAdmin(req.user.id);
  }
  res.render('content/equipment', {
    user: req.user,
    equipment,
    events,
    alert: req.query.alert,
    error: req.query.error,
    isAdmin,
    active: 'dashboard',
  });
});

router.post('/request', ensureAuth, async (req, res) => {
  const { equipment_id, event_id, quantity } = req.body;

  // Validate input
  if (!equipment_id || !event_id || !quantity) {
    return res.redirect('/equipment?error=Missing required fields.');
  }

  // Get equipment and event info for Discord embed
  let equipment;
  let event;
  try {
    equipment = db
      .prepare('SELECT * FROM equipment WHERE id = ?')
      .get(equipment_id);
    event = db.prepare('SELECT * FROM events WHERE id = ?').get(event_id);
  } catch (err) {
    console.error('DB error fetching equipment/event:', err);
    return res.redirect('/equipment?error=Database error. Please try again.');
  }

  if (!equipment || !event) {
    return res.redirect('/equipment?error=Invalid equipment or event.');
  }

  // Check if enough equipment is available
  if (equipment.available_quantity < quantity) {
    return res.redirect('/equipment?error=Not enough equipment available.');
  }

  // Create a unique request ID (could use uuid or your DB's autoincrement)
  const requestId = uuidv4();

  // Save to DB (insert or update if exists)
  try {
    db.prepare(
      `
        INSERT INTO equipment_requests
        (event_id, equipment_id, quantity, requested_by, requested_at, status, request_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id, equipment_id) DO UPDATE SET
          quantity = excluded.quantity,
          requested_by = excluded.requested_by,
          requested_at = excluded.requested_at,
          status = excluded.status,
          request_id = excluded.request_id
      `
    ).run(
      event_id,
      equipment_id,
      Number(quantity),
      req.user.id,
      new Date().toISOString(),
      'pending',
      requestId
    );
  } catch (err) {
    console.error('DB error saving equipment request:', err);
    return res.redirect(
      '/equipment?error=Failed to save request. Please try again.'
    );
  }

  // Decrease available quantity
  try {
    db.prepare(
      `
        UPDATE equipment
        SET available_quantity = available_quantity - ?
        WHERE id = ?
      `
    ).run(Number(quantity), equipment_id);
  } catch (err) {
    console.error('DB error updating available quantity:', err);
    return res.redirect(
      '/equipment?error=Failed to update available quantity.'
    );
  }

  // Send to bot API for Discord posting
  try {
    const apiUrl = process.env.BOT_API_URL.replace(
      /\/api\/post-event$/,
      '/api/post-equipment'
    );
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
      },
      body: JSON.stringify({
        userId: req.user.id,
        username: req.user.username,
        equipment: {
          name: equipment.name,
          category: equipment.category,
          description: equipment.description,
        },
        event: {
          title: event.title,
          time: event.time, // should be a unix timestamp (seconds)
        },
        quantity,
        requestId,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Discord API error:', response.status, text);
      return res.redirect(
        '/equipment?error=Failed to notify staff on Discord. Please try again.'
      );
    }

    // Success!
    return res.redirect('/equipment?alert=Equipment request submitted!');
  } catch (err) {
    console.error('Fetch/network error posting to Discord API:', err);
    return res.redirect(
      '/equipment?error=Failed to notify staff on Discord. Please try again.'
    );
  }
});

// Admin: view all requests
router.get('/requests', ensureAdmin, (req, res) => {
  const requests = db
    .prepare(
      `
      SELECT er.*, e.name as equipment_name, ev.title as event_title, u.username as requested_by_username
      FROM equipment_requests er
      JOIN equipment e ON er.equipment_id = e.id
      JOIN events ev ON er.event_id = ev.id
      LEFT JOIN users u ON er.requested_by = u.id
      ORDER BY er.requested_at DESC
    `
    )
    .all();
  res.render('content/equipment_requests', {
    user: req.user,
    requests,
    alert: req.query.alert,
    error: req.query.error,
    isAdmin: true,
    active: 'dashboard',
  });
});

// Admin: approve/deny
router.post('/requests/:id/:action', ensureAdmin, (req, res) => {
  const { id, action } = req.params;

  // Fetch the request from the database
  const reqRow = db
    .prepare('SELECT * FROM equipment_requests WHERE id = ?')
    .get(id);

  if (!reqRow) {
    return res.redirect('/equipment/requests?error=Request not found');
  }

  // Handle "approve" action
  if (action === 'approve') {
    if (reqRow.status !== 'pending') {
      return res.redirect('/equipment/requests?error=Already processed');
    }

    db.prepare(
      "UPDATE equipment_requests SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?"
    ).run(req.user.id, new Date().toISOString(), id);

    return res.redirect('/equipment/requests?alert=Request approved');
  }

  // Handle "deny" action
  if (action === 'deny') {
    if (reqRow.status !== 'pending') {
      return res.redirect('/equipment/requests?error=Already processed');
    }

    db.prepare(
      "UPDATE equipment_requests SET status = 'denied', denied_by = ?, denied_at = ? WHERE id = ?"
    ).run(req.user.id, new Date().toISOString(), id);

    // Optionally, return equipment to available
    db.prepare(
      'UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?'
    ).run(reqRow.quantity, reqRow.equipment_id);

    return res.redirect('/equipment/requests?alert=Request denied');
  }

  // Handle "delete" action
  if (action === 'delete') {
    try {
      // Restore available quantity if the request was approved
      if (reqRow.status === 'approved') {
        db.prepare(
          `
					UPDATE equipment
					SET available_quantity = available_quantity + ?
					WHERE id = ?
				`
        ).run(reqRow.quantity, reqRow.equipment_id);
      }

      // Delete the request from the database
      db.prepare('DELETE FROM equipment_requests WHERE id = ?').run(id);

      return res.redirect(
        '/equipment/requests?alert=Request deleted successfully!'
      );
    } catch (err) {
      console.error('Error deleting request:', err);
      return res.redirect(
        '/equipment/requests?error=Failed to delete request.'
      );
    }
  }

  // Handle invalid actions
  return res.redirect('/equipment/requests?error=Invalid action');
});

router.post('/add', ensureAdmin, (req, res) => {
  const {
    name,
    category,
    total_quantity,
    available_quantity,
    description,
    status,
  } = req.body;

  // Validate input
  if (!name || !category || !total_quantity || !available_quantity) {
    return res.redirect('/equipment?error=Missing required fields.');
  }

  try {
    // Insert the new equipment into the database
    db.prepare(
      `
        INSERT INTO equipment (name, category, total_quantity, available_quantity, description, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(
      name,
      category,
      Number(total_quantity),
      Number(available_quantity),
      description || null,
      status || 'available'
    );

    res.redirect('/equipment?alert=Equipment added successfully!');
  } catch (err) {
    console.error('Error adding equipment:', err);
    res.redirect('/equipment?error=Failed to add equipment.');
  }
});

router.get('/out', (req, res) => {
  const outRequests = db
    .prepare(
      `
      SELECT er.*, e.name as equipment_name, ev.title as event_title, ev.time as event_time, u.username as requested_by_username
      FROM equipment_requests er
      JOIN equipment e ON er.equipment_id = e.id
      JOIN events ev ON er.event_id = ev.id
      LEFT JOIN users u ON er.requested_by = u.id
      WHERE er.status = 'approved'
      ORDER BY ev.time DESC, er.approved_at DESC
    `
    )
    .all();

  res.render('content/equipment_out', {
    user: req.user,
    outRequests,
    active: 'dashboard',
    isAdmin: req.user?.isAdmin,
  });
});

router.get('/edit/:id', ensureAdmin, (req, res) => {
  const equipment = db
    .prepare('SELECT * FROM equipment WHERE id = ?')
    .get(req.params.id);
  if (!equipment) return res.redirect('/equipment?error=Equipment not found.');
  res.render('content/equipment_edit', {
    user: req.user,
    equipment,
    isAdmin: true,
    active: 'equipment',
  });
});

// Handle edit POST
router.post('/edit/:id', ensureAdmin, (req, res) => {
  const {
    name,
    category,
    total_quantity,
    available_quantity,
    description,
    status,
  } = req.body;
  db.prepare(
    `
      UPDATE equipment
      SET name = ?, category = ?, total_quantity = ?, available_quantity = ?, description = ?, status = ?
      WHERE id = ?
    `
  ).run(
    name,
    category,
    Number(total_quantity),
    Number(available_quantity),
    description,
    status || 'available',
    req.params.id
  );
  res.redirect('/equipment?alert=Equipment updated!');
});

// Delete equipment
router.post('/delete/:id', ensureAdmin, (req, res) => {
  const equipmentId = req.params.id;

  try {
    // Delete all requests associated with this equipment
    db.prepare('DELETE FROM equipment_requests WHERE equipment_id = ?').run(
      equipmentId
    );

    // Delete the equipment itself
    db.prepare('DELETE FROM equipment WHERE id = ?').run(equipmentId);

    res.redirect('/equipment?alert=Equipment deleted successfully!');
  } catch (err) {
    console.error('Error deleting equipment:', err);
    res.redirect('/equipment?error=Failed to delete equipment.');
  }
});

export default router;
