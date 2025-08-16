import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This will always resolve to the project root, no matter where you run from:
const dbPath = path.resolve(__dirname, '../../../events.db'); // adjust as needed

let db;

export function setupDatabase() {
  db = new Database(dbPath);

  db.prepare(
    `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT,
          discord_tag TEXT,
          avatar_url TEXT
        )
      `
  ).run();

  db.prepare(
    `
        CREATE TABLE IF NOT EXISTS custom_forms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          fields TEXT NOT NULL, -- JSON string of field definitions
          ping_role_id TEXT,
          created_by TEXT,
          created_at TEXT
        )
      `
  ).run();

  // Ensure the events table has the necessary columns
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      creator_id TEXT,
      title TEXT,
      description TEXT,
      time TEXT,
      location TEXT,
      image TEXT,
      message_id TEXT,
      channel_id TEXT
    )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      found_unit TEXT,
      steam64 TEXT,
      discord_username TEXT,
      unit_name TEXT,
      age INTEGER,
      experience TEXT,
      mos TEXT,
      status TEXT DEFAULT 'pending',
      submitted_at TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      denied_by TEXT,
      denied_at TEXT,
      denial_reason TEXT,
      notes TEXT,
      updated_at TEXT,
      updated_by TEXT
    )
  `
  ).run();

  // Add missing columns if they don't exist (for existing databases)
  try {
    db.prepare('ALTER TABLE applications ADD COLUMN notes TEXT').run();
  } catch (e) {
    // Column already exists
  }
  
  try {
    db.prepare('ALTER TABLE applications ADD COLUMN updated_at TEXT').run();
  } catch (e) {
    // Column already exists
  }
  
  try {
    db.prepare('ALTER TABLE applications ADD COLUMN updated_by TEXT').run();
  } catch (e) {
    // Column already exists
  }

  // Create database health logs table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS database_health_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      table_size_bytes INTEGER,
      last_updated TEXT NOT NULL,
      health_score INTEGER NOT NULL,
      issues TEXT
    )
  `).run();
  // Remove any rows with id = NULL
  db.prepare('DELETE FROM applications WHERE id IS NULL').run();

  // Create application_config table for form configuration
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS application_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      questions TEXT NOT NULL,
      updated_by TEXT,
      created_at TEXT
    )
  `
  ).run();

  // Insert default form configuration if none exists
  const existingConfig = db.prepare('SELECT COUNT(*) as count FROM application_config').get();
  if (existingConfig.count === 0) {
    const defaultQuestions = JSON.stringify([
      {
        "id": "foundUnit",
        "label": "How did you find the unit?",
        "type": "text",
        "required": true,
        "placeholder": "e.g., Discord, Reddit, Friend, etc."
      },
      {
        "id": "steam64",
        "label": "What is your Steam64 ID?",
        "type": "text",
        "required": true,
        "placeholder": "https://steamcommunity.com/profiles/76561198...",
        "help": "You can find your Steam64 ID at https://steamidfinder.com/"
      },
      {
        "id": "unitName",
        "label": "The first initial, followed by the last name you would like to use within the unit",
        "type": "text",
        "required": true,
        "placeholder": "e.g., J.Smith"
      },
      {
        "id": "age",
        "label": "How old are you?",
        "type": "number",
        "required": true,
        "min": 13,
        "max": 100
      },
      {
        "id": "experience",
        "label": "List any prior experience with MILSIM",
        "type": "textarea",
        "required": false,
        "rows": 4,
        "placeholder": "Describe your experience with MILSIM units, games, etc."
      },
      {
        "id": "mos",
        "label": "What is your desired MOS/AFSC?",
        "type": "select",
        "required": true,
        "options": [
          {"value": "", "label": "Select an MOS/AFSC", "disabled": true},
          {"value": "11B", "label": "11B - Infantryman"},
          {"value": "11C", "label": "11C - Indirect Fire Infantryman"},
          {"value": "68W", "label": "68W - Combat Medic"},
          {"value": "25B", "label": "25B - Information Technology Specialist"},
          {"value": "25C", "label": "25C - Radio Operator-Maintainer"},
          {"value": "25U", "label": "25U - Signal Support Systems Specialist"}
        ]
      }
    ]);
    
    db.prepare(
      `
      INSERT INTO application_config (questions, updated_by, created_at)
      VALUES (?, ?, DATETIME('now'))
    `
    ).run(defaultQuestions, 'system');
  }

  // Ensure warnings table exists
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS warnings (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT,
      timestamp TEXT NOT NULL
    )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS personnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position TEXT,
      callsign TEXT,
      status TEXT,
      name TEXT,
      discord_id TEXT,
      discord_username TEXT,
      discord_avatar TEXT,
      role TEXT,
      mos TEXT,
      platoon TEXT,
      squad TEXT,
      sort_order INTEGER,
      squad_order INTEGER,
      platoon_order INTEGER
    );
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS modpacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );
  `
  ).run();
  db.prepare(
    `
  CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT
  )
`
  ).run();

  db.prepare(
    `
  CREATE TABLE IF NOT EXISTS appeals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending',
    submitted_at TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_notes TEXT
  )
`
  ).run();

  // Create gallery_images table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS gallery_images (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      description TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      file_size INTEGER DEFAULT 0
    )
  `).run();

  // Create user_activity table for tracking user activity
  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  // Create form_templates table for advanced form features
  db.prepare(`
    CREATE TABLE IF NOT EXISTS form_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      fields TEXT NOT NULL, -- JSON string of field definitions
      conditional_logic TEXT, -- JSON string of conditional logic
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      is_active BOOLEAN DEFAULT 1,
      success_message TEXT DEFAULT 'Thank you for your submission!',
      max_responses INTEGER,
      expiry_date TEXT,
      response_count INTEGER DEFAULT 0
    )
  `).run();

  // Add missing columns if they don't exist
  try {
    db.prepare('ALTER TABLE form_templates ADD COLUMN success_message TEXT DEFAULT "Thank you for your submission!"').run();
  } catch (e) {
    // Column already exists
  }
  
  try {
    db.prepare('ALTER TABLE form_templates ADD COLUMN max_responses INTEGER').run();
  } catch (e) {
    // Column already exists
  }
  
  try {
    db.prepare('ALTER TABLE form_templates ADD COLUMN expiry_date TEXT').run();
  } catch (e) {
    // Column already exists
  }
  
  try {
    db.prepare('ALTER TABLE form_templates ADD COLUMN response_count INTEGER DEFAULT 0').run();
  } catch (e) {
    // Column already exists
  }

  // Create form_responses table for form analytics
  db.prepare(`
    CREATE TABLE IF NOT EXISTS form_responses (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      user_id TEXT,
      responses TEXT NOT NULL, -- JSON string of responses
      completion_time INTEGER, -- seconds to complete
      started_at TEXT NOT NULL,
      completed_at TEXT,
      ip_address TEXT,
      user_agent TEXT
    )
  `).run();

  // Create financial_transactions table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS financial_transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'donation', 'expense', 'income'
      amount DECIMAL(10,2) NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      donor_name TEXT,
      donor_email TEXT,
      payment_method TEXT,
      transaction_date TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      notes TEXT
    )
  `).run();

  // Create financial_categories table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS financial_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'income', 'expense'
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  // Create budget_plans table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS budget_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      period TEXT NOT NULL, -- 'monthly', 'quarterly', 'yearly'
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_budget DECIMAL(10,2) NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT
    )
  `).run();

  // Create budget_items table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS budget_items (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      category_id INTEGER,
      name TEXT NOT NULL,
      planned_amount DECIMAL(10,2) NOT NULL,
      actual_amount DECIMAL(10,2) DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (budget_id) REFERENCES budget_plans(id),
      FOREIGN KEY (category_id) REFERENCES financial_categories(id)
    )
  `).run();

  // Create database_health_logs table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS database_health_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      table_size_bytes INTEGER,
      last_updated TEXT NOT NULL,
      health_score INTEGER, -- 0-100
      issues TEXT -- JSON string of issues found
    )
  `).run();

  // Auto-migrate: Ensure required columns exist in the 'gallery_images' table
  const galleryRequiredColumns = {
    id: 'TEXT PRIMARY KEY',
    filename: 'TEXT NOT NULL',
    original_name: 'TEXT NOT NULL',
    description: 'TEXT',
    uploaded_by: 'TEXT NOT NULL',
    uploaded_at: 'TEXT NOT NULL',
    display_order: 'INTEGER DEFAULT 0',
    file_size: 'INTEGER DEFAULT 0'
  };

  // Get current columns in the gallery_images table
  let galleryExistingColumns = db
    .prepare('PRAGMA table_info(gallery_images)')
    .all()
    .map(col => col.name);

  // Add missing columns to gallery_images table
  for (const [column, type] of Object.entries(galleryRequiredColumns)) {
    if (!galleryExistingColumns.includes(column)) {
      console.log(`Adding missing column '${column}' to 'gallery_images' table...`);
      try {
        db.prepare(`ALTER TABLE gallery_images ADD COLUMN ${column} ${type}`).run();
        galleryExistingColumns.push(column);
      } catch (e) {
        console.log(`Column '${column}' already exists or cannot be added:`, e.message);
      }
    }
  }

  // Auto-migrate: Ensure required columns exist in the 'events' table
  const requiredColumns = {
    id: 'TEXT PRIMARY KEY',
    creator_id: 'TEXT',
    title: 'TEXT',
    description: 'TEXT',
    time: 'TEXT',
    location: 'TEXT',
    image: 'TEXT',
    message_id: 'TEXT',
    channel_id: 'TEXT',
  };

  // Get current columns in the table
  // biome-ignore lint/style/useConst: <explanation>
  let existingColumns = db
    .prepare('PRAGMA table_info(events)')
    .all()
    .map(col => col.name);

  // Add missing columns
  for (const [column, type] of Object.entries(requiredColumns)) {
    if (!existingColumns.includes(column)) {
      console.log(`Adding missing column '${column}' to 'events' table...`);
      db.prepare(`ALTER TABLE events ADD COLUMN ${column} ${type}`).run();
      existingColumns.push(column);
    }
  }

  // MIGRATION: If both 'duration' and 'location' exist, copy data
  if (
    existingColumns.includes('duration') &&
    existingColumns.includes('location')
  ) {
    console.log("Copying 'duration' data to 'location'...");
    db.prepare(
      "UPDATE events SET location = duration WHERE duration IS NOT NULL AND (location IS NULL OR location = '')"
    ).run();
  }

  // SAFELY REMOVE 'duration' COLUMN (requires table recreation in SQLite)
  if (existingColumns.includes('duration')) {
    console.log("Removing 'duration' column from 'events' table...");
    db.exec(`
			BEGIN TRANSACTION;
			CREATE TABLE events_new (
				id TEXT PRIMARY KEY,
				creator_id TEXT,
				title TEXT,
				description TEXT,
				time TEXT,
				location TEXT,
				image TEXT,
				message_id TEXT,
				channel_id TEXT
			);
			INSERT INTO events_new (id, creator_id, title, description, time, location, image, message_id, channel_id)
				SELECT id, creator_id, title, description, time, location, image, message_id, channel_id FROM events;
			DROP TABLE events;
			ALTER TABLE events_new RENAME TO events;
			COMMIT;
		`);
    console.log("'duration' column removed.");
  }

  // Ensure RSVP table exists
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS rsvps (
      event_id TEXT,
      user_id TEXT,
      status TEXT,
      PRIMARY KEY (event_id, user_id)
    )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS loa_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      unit_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      begin_date TEXT NOT NULL,
      return_date TEXT NOT NULL,
      first_line TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      denied_by TEXT,
      denied_at TEXT,
      denial_reason TEXT
    );
  `
  ).run();

  // Create staff_profiles table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS staff_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      title TEXT,
      description TEXT,
      image_filename TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `).run();

  // Create document center tables
  db.prepare(`
    CREATE TABLE IF NOT EXISTS document_tabs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT,
      updated_by TEXT,
      updated_at TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      tab_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      url TEXT,
      content TEXT, -- Rich text content for built-in docs
      content_type TEXT DEFAULT 'external', -- 'external' for URLs, 'builtin' for rich content
      required_mos TEXT,
      sort_order INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT,
      updated_by TEXT,
      updated_at TEXT,
      FOREIGN KEY (tab_id) REFERENCES document_tabs(id) ON DELETE CASCADE
    )
  `).run();
  
  // Add content and content_type columns to existing documents table if they don't exist
  try {
    db.prepare('ALTER TABLE documents ADD COLUMN content TEXT').run();
  } catch (e) {
    // Column already exists
  }
  
  try {
    db.prepare('ALTER TABLE documents ADD COLUMN content_type TEXT DEFAULT "external"').run();
  } catch (e) {
    // Column already exists
  }

  setupEquipmentTables();

  return db;
}

// utils/database.js
export function addPersonnel(person) {
  const db = getDatabase();
  db.prepare(
    `
		INSERT INTO personnel
		(discord_id, discord_username, name, role, status)
		VALUES (?, ?, ?, ?, ?)
	`
  ).run(
    person.discord_id,
    person.discord_username,
    person.name,
    person.role,
    person.status
  );
}

// Add a warning
export function addWarning(guildId, userId, moderatorId, reason) {
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  getDatabase()
    .prepare(
      `
      INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    )
    .run(id, guildId, userId, moderatorId, reason, timestamp);
  return id;
}

// Remove a warning by warning ID
export function removeWarning(warningId) {
  return getDatabase()
    .prepare('DELETE FROM warnings WHERE id = ?')
    .run(warningId);
}

// List all warnings for a user in a guild
export function getWarnings(guildId, userId) {
  return getDatabase()
    .prepare(
      'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC'
    )
    .all(guildId, userId);
}

// Get a single warning by ID
export function getWarning(warningId) {
  return getDatabase()
    .prepare('SELECT * FROM warnings WHERE id = ?')
    .get(warningId);
}

export function getDatabase() {
  if (!db) {
    setupDatabase();
  }
  return db;
}

import { v4 as uuidv4 } from 'uuid';

export function createApplication(app) {
  const id = uuidv4();
  const submitted_at = new Date().toISOString();
  getDatabase()
    .prepare(
      `
		INSERT INTO applications (
			id, user_id, username, found_unit, steam64, discord_username, unit_name, age, experience, mos, submitted_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
    )
    .run(
      id,
      app.userId,
      app.username,
      app.foundUnit,
      app.steam64,
      app.discordUsername,
      app.unitName,
      app.age,
      app.experience,
      app.mos,
      submitted_at
    );
  return id;
}

export function getApplication(appId) {
  return getDatabase()
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(appId);
}

export function approveApplication(appId, approverId) {
  return getDatabase()
    .prepare(
      `
			UPDATE applications
			SET status = 'approved', approved_by = ?, approved_at = ?
			WHERE id = ?
		`
    )
    .run(approverId, new Date().toISOString(), appId);
}

export function denyApplication(appId, denierId, reason) {
  return getDatabase()
    .prepare(
      `
			UPDATE applications
			SET status = 'denied', denied_by = ?, denied_at = ?, denial_reason = ?
			WHERE id = ?
		`
    )
    .run(denierId, new Date().toISOString(), reason, appId);
}

// Database operations
export function createEvent(eventData) {
  const {
    id,
    creator_id,
    title,
    description,
    time,
    location,
    image,
    message_id,
    channel_id,
  } = eventData;

  return getDatabase()
    .prepare(
      `
    INSERT INTO events (id, creator_id, title, description, time, location, image, message_id, channel_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      id,
      creator_id,
      title,
      description,
      parseInt(time, 10),
      location,
      image,
      message_id,
      channel_id
    );
}

export function updateRSVP(eventId, userId, status) {
  return getDatabase()
    .prepare(
      `
    INSERT INTO rsvps (event_id, user_id, status)
    VALUES (?, ?, ?)
    ON CONFLICT(event_id, user_id) DO UPDATE SET status=excluded.status
  `
    )
    .run(eventId, userId, status);
}

export function getEvent(eventId) {
  return getDatabase()
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(eventId);
}

export function getRSVPs(eventId, status) {
  return getDatabase()
    .prepare('SELECT user_id FROM rsvps WHERE event_id = ? AND status = ?')
    .all(eventId, status);
}

// Setup equipment tables
export function updateEquipmentRequestStatus(eventId, equipmentId, status) {
  return getDatabase()
    .prepare(
      `
    UPDATE equipment_requests 
    SET status = ? 
    WHERE event_id = ? AND equipment_id = ?
    `
    )
    .run(status, eventId, equipmentId);
}

export function setupEquipmentTables() {
  const db = getDatabase();

  // Create equipment inventory table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      available_quantity INTEGER NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'available'
    )
  `
  ).run();

  // Create equipment requests table with request_id included by default
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS equipment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      request_id TEXT,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id),
      UNIQUE(event_id, equipment_id)
    )
  `
  ).run();

  // Check if request_id column exists, add if not
  const columns = db.prepare('PRAGMA table_info(equipment_requests)').all();
  if (!columns.some(col => col.name === 'request_id')) {
    console.log('Adding request_id column to equipment_requests table');
    db.prepare(
      'ALTER TABLE equipment_requests ADD COLUMN request_id TEXT'
    ).run();
  }
}

// Equipment inventory operations
export function addEquipment(equipmentData) {
  const { id, name, category, total_quantity, description, status } =
    equipmentData;

  return getDatabase()
    .prepare(
      `
    INSERT INTO equipment (id, name, category, total_quantity, available_quantity, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      id,
      name,
      category,
      total_quantity,
      total_quantity,
      description,
      status || 'available'
    );
}

export function getEquipment(equipmentId) {
  return getDatabase()
    .prepare('SELECT * FROM equipment WHERE id = ?')
    .get(equipmentId);
}

export function getAllEquipment() {
  return getDatabase()
    .prepare('SELECT * FROM equipment ORDER BY category, name')
    .all();
}

export function getAvailableEquipment() {
  return getDatabase()
    .prepare(
      "SELECT * FROM equipment WHERE available_quantity > 0 AND status = 'available' ORDER BY category, name"
    )
    .all();
}

// Equipment request operations
export function requestEquipment(requestData) {
  const { event_id, equipment_id, quantity, requested_by, request_id } =
    requestData;
  const requested_at = new Date().toISOString();

  const db = getDatabase();

  // Start a transaction
  const transaction = db.transaction(() => {
    // Check if equipment is available in sufficient quantity
    const equipment = db
      .prepare('SELECT available_quantity FROM equipment WHERE id = ?')
      .get(equipment_id);

    if (!equipment || equipment.available_quantity < quantity) {
      throw new Error('Insufficient equipment available');
    }

    // Update available quantity
    db.prepare(
      'UPDATE equipment SET available_quantity = available_quantity - ? WHERE id = ?'
    ).run(quantity, equipment_id);

    // Check if the request_id column exists
    const columns = db.prepare('PRAGMA table_info(equipment_requests)').all();
    const hasRequestIdColumn = columns.some(col => col.name === 'request_id');

    // Create or update the request with request_id if the column exists
    if (hasRequestIdColumn && request_id) {
      console.log(`Adding equipment request with ID: ${request_id}`);

      // First check if a request with this event_id and equipment_id already exists
      const existingRequest = db
        .prepare(
          'SELECT * FROM equipment_requests WHERE event_id = ? AND equipment_id = ?'
        )
        .get(event_id, equipment_id);

      if (existingRequest) {
        // Update existing request
        return db
          .prepare(
            `
            UPDATE equipment_requests 
            SET quantity = quantity + ?, 
                requested_at = ?, 
                status = 'pending',
                request_id = ?
            WHERE event_id = ? AND equipment_id = ?
          `
          )
          .run(quantity, requested_at, request_id, event_id, equipment_id);
      }
      // Insert new request
      return db
        .prepare(
          `
            INSERT INTO equipment_requests 
            (event_id, equipment_id, quantity, requested_by, requested_at, status, request_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          event_id,
          equipment_id,
          quantity,
          requested_by,
          requested_at,
          'pending',
          request_id
        );
    }
    // Use the original query without request_id
    return db
      .prepare(
        `
          INSERT INTO equipment_requests 
          (event_id, equipment_id, quantity, requested_by, requested_at, status)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(event_id, equipment_id) 
          DO UPDATE SET quantity = quantity + excluded.quantity, 
                        requested_at = excluded.requested_at,
                        status = 'pending'
        `
      )
      .run(
        event_id,
        equipment_id,
        quantity,
        requested_by,
        requested_at,
        'pending'
      );
  });

  try {
    const result = transaction();

    // Verify the request was added with the request_id
    if (request_id) {
      const addedRequest = db
        .prepare('SELECT * FROM equipment_requests WHERE request_id = ?')
        .get(request_id);
      console.log('Verified added request:', addedRequest);
    }

    return result;
  } catch (error) {
    console.error('Error in requestEquipment transaction:', error);
    throw error;
  }
}

export function removeEquipmentRequest(eventId, equipmentId) {
  const db = getDatabase();

  // Start a transaction
  const transaction = db.transaction(() => {
    // Get the current quantity
    const request = db
      .prepare(
        'SELECT quantity FROM equipment_requests WHERE event_id = ? AND equipment_id = ?'
      )
      .get(eventId, equipmentId);

    if (!request) {
      throw new Error('Equipment request not found');
    }

    // Return the quantity to available
    db.prepare(
      'UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?'
    ).run(request.quantity, equipmentId);

    // Delete the request
    return db
      .prepare(
        'DELETE FROM equipment_requests WHERE event_id = ? AND equipment_id = ?'
      )
      .run(eventId, equipmentId);
  });

  return transaction();
}

export function resetEntireInventory() {
  const db = getDatabase();
  db.prepare('UPDATE equipment SET available_quantity = total_quantity').run();
  // Optionally, clear all equipment requests as well:
  db.prepare('DELETE FROM equipment_requests').run();
}

export function resetInventoryForEndedEvents() {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000); // assuming event.time is stored as a unix timestamp

  const endedEvents = db
    .prepare('SELECT id FROM events WHERE time <= ?')
    .all(now);

  const transaction = db.transaction(() => {
    for (const event of endedEvents) {
      // Get all equipment requests for this event
      const requests = db
        .prepare(
          'SELECT equipment_id, quantity FROM equipment_requests WHERE event_id = ?'
        )
        .all(event.id);

      // Return each equipment's quantity to available_quantity
      for (const req of requests) {
        db.prepare(
          'UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?'
        ).run(req.quantity, req.equipment_id);
      }

      // Delete all equipment requests for this event
      db.prepare('DELETE FROM equipment_requests WHERE event_id = ?').run(
        event.id
      );
    }
  });

  transaction();
}

export function returnEquipmentForEvent(eventId) {
  const db = getDatabase();
  const requests = db
    .prepare(
      'SELECT equipment_id, quantity FROM equipment_requests WHERE event_id = ?'
    )
    .all(eventId);

  for (const req of requests) {
    db.prepare(
      'UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?'
    ).run(req.quantity, req.equipment_id);
  }
}

export function removeEquipment(equipmentId) {
  const db = getDatabase();

  // First, delete all equipment requests for this equipment
  db.prepare('DELETE FROM equipment_requests WHERE equipment_id = ?').run(
    equipmentId
  );

  // Then, delete the equipment itself
  return db.prepare('DELETE FROM equipment WHERE id = ?').run(equipmentId);
}

export function getEventEquipment(eventId) {
  return getDatabase()
    .prepare(
      `
    SELECT er.*, e.name, e.category, e.description, e.status as equipment_status
    FROM equipment_requests er
    JOIN equipment e ON er.equipment_id = e.id
    WHERE er.event_id = ?
    ORDER BY e.category, e.name
    `
    )
    .all(eventId);
}

// New function to get equipment request by request_id
export function getEquipmentRequestByRequestId(requestId) {
  return getDatabase()
    .prepare(
      `
    SELECT er.*, e.name, e.category, e.description, e.status as equipment_status
    FROM equipment_requests er
    JOIN equipment e ON er.equipment_id = e.id
    WHERE er.request_id = ?
    `
    )
    .get(requestId);
}

// New function to update equipment request status by request_id
export function updateEquipmentRequestStatusByRequestId(requestId, status) {
  return getDatabase()
    .prepare(
      `
    UPDATE equipment_requests 
    SET status = ? 
    WHERE request_id = ?
    `
    )
    .run(status, requestId);
}

export function editEquipment(
  equipmentId,
  { name, category, quantity, description }
) {
  const db = getDatabase();
  const updates = [];
  const params = [];

  if (name) {
    updates.push('name = ?');
    params.push(name);
  }
  if (category) {
    updates.push('category = ?');
    params.push(category);
  }
  if (quantity) {
    updates.push('total_quantity = ?', 'available_quantity = ?');
    params.push(quantity, quantity); // Optionally, only update available_quantity if you want
  }
  if (description) {
    updates.push('description = ?');
    params.push(description);
  }
  if (updates.length === 0) return;

  const sql = `UPDATE equipment SET ${updates.join(', ')} WHERE id = ?`;
  params.push(equipmentId);
  db.prepare(sql).run(...params);
}

// Call this in setupDatabase()
export function setupCertificationTables() {
  const db = getDatabase();

  db.prepare(
    `
		CREATE TABLE IF NOT EXISTS certifications (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			required_mos TEXT,
			category TEXT
		)
	`
  ).run();

  // Add required_mos column if it doesn't exist (for existing databases)
  try {
    db.prepare('ALTER TABLE certifications ADD COLUMN required_mos TEXT').run();
  } catch (err) {
    // Column already exists, ignore error
  }

  // Add category column if it doesn't exist (for existing databases)
  try {
    db.prepare('ALTER TABLE certifications ADD COLUMN category TEXT').run();
  } catch (err) {
    // Column already exists, ignore error
  }

  db.prepare(
    `
		CREATE TABLE IF NOT EXISTS certification_requests (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			cert_id TEXT NOT NULL,
			status TEXT DEFAULT 'pending',
			requested_at TEXT NOT NULL,
			approved_by TEXT,
			approved_at TEXT,
			denied_by TEXT,
			denied_at TEXT,
			denial_reason TEXT,
			FOREIGN KEY (cert_id) REFERENCES certifications(id)
		)
	`
  ).run();
}

// Add to setupDatabase()
setupCertificationTables();

// Certification operations
export function addCertification({ id, name, description, required_mos, category }) {
  return getDatabase()
    .prepare(
      'INSERT INTO certifications (id, name, description, required_mos, category) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, name, description, required_mos, category);
}

export function getAllCertifications() {
  return getDatabase()
    .prepare('SELECT * FROM certifications ORDER BY name')
    .all();
}

export function getCertification(certId) {
  return getDatabase()
    .prepare('SELECT * FROM certifications WHERE id = ?')
    .get(certId);
}

export function requestCertification({ user_id, cert_id }) {
  const db = getDatabase();
  const id = uuidv4();
  const requested_at = new Date().toISOString();
  return db
    .prepare(
      `
		INSERT INTO certification_requests (id, user_id, cert_id, requested_at)
		VALUES (?, ?, ?, ?)
	`
    )
    .run(id, user_id, cert_id, requested_at);
}

export function getPendingCertificationRequests() {
  return getDatabase()
    .prepare(
      `
			SELECT cr.*, c.name as cert_name, c.description as cert_description
			FROM certification_requests cr
			JOIN certifications c ON cr.cert_id = c.id
			WHERE cr.status = 'pending'
			ORDER BY cr.requested_at ASC
		`
    )
    .all();
}

export function getCertificationRequest(requestId) {
  return getDatabase()
    .prepare(
      `
			SELECT cr.*, c.name as cert_name, c.description as cert_description
			FROM certification_requests cr
			JOIN certifications c ON cr.cert_id = c.id
			WHERE cr.id = ?
		`
    )
    .get(requestId);
}

export function approveCertificationRequest(requestId, adminId) {
  const db = getDatabase();
  return db
    .prepare(
      `
		UPDATE certification_requests
		SET status = 'approved', approved_by = ?, approved_at = ?
		WHERE id = ?
	`
    )
    .run(adminId, new Date().toISOString(), requestId);
}

export function denyCertificationRequest(requestId, adminId, reason) {
  const db = getDatabase();
  return db
    .prepare(
      `
		UPDATE certification_requests
		SET status = 'denied', denied_by = ?, denied_at = ?, denial_reason = ?
		WHERE id = ?
	`
    )
    .run(adminId, new Date().toISOString(), reason, requestId);
}

export function getUserCertifications(userId) {
  return getDatabase()
    .prepare(
      `
			SELECT c.name, c.description, cr.approved_at
			FROM certification_requests cr
			JOIN certifications c ON cr.cert_id = c.id
			WHERE cr.user_id = ? AND cr.status = 'approved'
			ORDER BY cr.approved_at DESC
		`
    )
    .all(userId);
}

export function editCertification(
  certId,
  newName,
  newDescription,
  newRequiredMos,
  newCategory
) {
  const db = getDatabase();
  db.prepare(
    'UPDATE certifications SET name = ?, description = ?, required_mos = ?, category = ? WHERE id = ?'
  ).run(newName, newDescription, newRequiredMos, newCategory, certId);
}

export function deleteCertification(certId) {
  const db = getDatabase();
  // Delete all requests for this cert first
  db.prepare('DELETE FROM certification_requests WHERE cert_id = ?').run(
    certId
  );
  // Then delete the cert itself
  db.prepare('DELETE FROM certifications WHERE id = ?').run(certId);
}

export function getUserCertRequestStatus(userId, certId) {
  const db = getDatabase();
  return db
    .prepare(
      'SELECT status FROM certification_requests WHERE user_id = ? AND cert_id = ? ORDER BY requested_at DESC LIMIT 1'
    )
    .get(userId, certId);
}
export function createSnippet({ name, content, created_by }) {
  const db = getDatabase();
  const id = uuidv4();
  const created_at = new Date().toISOString();
  db.prepare(
    `
		INSERT INTO snippets (id, name, content, created_by, created_at)
		VALUES (?, ?, ?, ?, ?)
	`
  ).run(id, name, content, created_by, created_at);
  return id;
}

// Get a snippet by name
export function getSnippetByName(name) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM snippets WHERE name = ?').get(name);
}

// Get all snippets
export function getAllSnippets() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM snippets ORDER BY name').all();
}

// Delete a snippet by name
export function deleteSnippetByName(name) {
  const db = getDatabase();
  return db.prepare('DELETE FROM snippets WHERE name = ?').run(name);
}

// Edit a snippet by name
export function editSnippetByName(name, newContent) {
  const db = getDatabase();
  return db
    .prepare('UPDATE snippets SET content = ? WHERE name = ?')
    .run(newContent, name);
}
// For autocomplete: get snippet names matching a prefix
export function findSnippetNames(prefix) {
  const db = getDatabase();
  return db
    .prepare(
      'SELECT name FROM snippets WHERE name LIKE ? ORDER BY name LIMIT 25'
    )
    .all(`${prefix}%`);
}

// User Activity Tracking Functions
export function logUserActivity(userId, activityType, details = null, ipAddress = null, userAgent = null) {
  return getDatabase()
    .prepare(`
      INSERT INTO user_activity (user_id, activity_type, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(userId, activityType, details, ipAddress, userAgent, new Date().toISOString());
}

export function getUserActivity(userId, limit = 50) {
  return getDatabase()
    .prepare(`
      SELECT * FROM user_activity 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    .all(userId, limit);
}

export function getAllUserActivity(limit = 100) {
  return getDatabase()
    .prepare(`
      SELECT ua.*, u.username, u.discord_tag 
      FROM user_activity ua
      LEFT JOIN users u ON ua.user_id = u.id
      ORDER BY ua.created_at DESC 
      LIMIT ?
    `)
    .all(limit);
}

// Staff profile helpers
export function addStaffProfile({ id, user_id, title }) {
  const db = getDatabase();
  const created_at = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO staff_profiles (id, user_id, title, created_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `
  ).run(id, user_id, title || null, created_at);
  return id;
}

export function getAllStaffProfiles() {
  return getDatabase()
    .prepare('SELECT * FROM staff_profiles WHERE is_active = 1 ORDER BY display_order ASC, created_at ASC')
    .all();
}

export function getStaffProfileByUserId(userId) {
  return getDatabase()
    .prepare('SELECT * FROM staff_profiles WHERE user_id = ?')
    .get(userId);
}

export function updateStaffProfileByUserId(userId, { title, description, image_filename }) {
  const db = getDatabase();
  const fields = [];
  const params = [];
  if (title !== undefined) {
    fields.push('title = ?');
    params.push(title || null);
  }
  if (description !== undefined) {
    fields.push('description = ?');
    params.push(description || null);
  }
  if (image_filename !== undefined) {
    fields.push('image_filename = ?');
    params.push(image_filename || null);
  }
  fields.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(userId);
  if (fields.length === 1) return; // only updated_at added; nothing to update
  db.prepare(`UPDATE staff_profiles SET ${fields.join(', ')} WHERE user_id = ?`).run(...params);
}

export function deleteStaffProfileById(id) {
  return getDatabase().prepare('DELETE FROM staff_profiles WHERE id = ?').run(id);
}

export function getStaffProfileById(id) {
  return getDatabase().prepare('SELECT * FROM staff_profiles WHERE id = ?').get(id);
}

export function updateStaffProfileById(id, { title, description, is_active }) {
  const db = getDatabase();
  const fields = [];
  const params = [];
  if (title !== undefined) {
    fields.push('title = ?');
    params.push(title || null);
  }
  if (description !== undefined) {
    fields.push('description = ?');
    params.push(description || null);
  }
  if (is_active !== undefined) {
    fields.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }
  fields.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  if (fields.length === 1) return; // only updated_at
  db.prepare(`UPDATE staff_profiles SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}

export function setStaffOrder(orderIds) {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE staff_profiles SET display_order = ? WHERE id = ?');
  let order = 1;
  for (const id of orderIds) {
    stmt.run(order, id);
    order += 1;
  }
}

export function getActivityStats(days = 30) {
  const db = getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return db.prepare(`
    SELECT 
      activity_type,
      COUNT(*) as count,
      DATE(created_at) as date
    FROM user_activity 
    WHERE created_at >= ?
    GROUP BY activity_type, DATE(created_at)
    ORDER BY date DESC, count DESC
  `).all(cutoffDate.toISOString());
}

// Form Template Functions
export function createFormTemplate(templateData) {
  const { id, name, description, fields, conditionalLogic, createdBy, successMessage, maxResponses, expiryDate } = templateData;
  return getDatabase()
    .prepare(`
      INSERT INTO form_templates (id, name, description, fields, conditional_logic, created_by, created_at, success_message, max_responses, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(id, name, description, JSON.stringify(fields), JSON.stringify(conditionalLogic), createdBy, new Date().toISOString(), successMessage || 'Thank you for your submission!', maxResponses || null, expiryDate || null);
}

export function getAllFormTemplates() {
  return getDatabase()
    .prepare('SELECT * FROM form_templates ORDER BY created_at DESC')
    .all();
}

export function getFormTemplate(templateId) {
  return getDatabase()
    .prepare('SELECT * FROM form_templates WHERE id = ?')
    .get(templateId);
}

export function updateFormTemplate(templateId, updates) {
  const db = getDatabase();
  const updateFields = [];
  const params = [];
  
  // Helper function to ensure valid SQLite3 types
  const ensureValidType = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  
  if (updates.name !== undefined) {
    updateFields.push('name = ?');
    params.push(ensureValidType(updates.name));
  }
  if (updates.description !== undefined) {
    updateFields.push('description = ?');
    params.push(ensureValidType(updates.description));
  }
  if (updates.fields !== undefined) {
    updateFields.push('fields = ?');
    params.push(JSON.stringify(updates.fields));
  }
  if (updates.conditionalLogic !== undefined) {
    updateFields.push('conditional_logic = ?');
    params.push(updates.conditionalLogic ? updates.conditionalLogic : null);
  }
  if (updates.isActive !== undefined) {
    updateFields.push('is_active = ?');
    params.push(updates.isActive ? 1 : 0);
  }
  if (updates.successMessage !== undefined) {
    updateFields.push('success_message = ?');
    params.push(ensureValidType(updates.successMessage));
  }
  if (updates.maxResponses !== undefined) {
    updateFields.push('max_responses = ?');
    params.push(updates.maxResponses ? parseInt(updates.maxResponses) : null);
  }
  if (updates.expiryDate !== undefined) {
    updateFields.push('expiry_date = ?');
    params.push(ensureValidType(updates.expiryDate));
  }
  
  updateFields.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(templateId);
  
  console.log('Update params:', params); // Debug log
  
  return db.prepare(`
    UPDATE form_templates 
    SET ${updateFields.join(', ')} 
    WHERE id = ?
  `).run(...params);
}

export function deleteFormTemplate(templateId) {
  return getDatabase()
    .prepare('DELETE FROM form_templates WHERE id = ?')
    .run(templateId);
}

// Form Response Functions
export function saveFormResponse(responseData) {
  const { id, formId, userId, responses, completionTime, startedAt, completedAt, ipAddress, userAgent } = responseData;
  
  const db = getDatabase();
  
  // Save the response
  db.prepare(`
    INSERT INTO form_responses (id, form_id, user_id, responses, completion_time, started_at, completed_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, formId, userId, JSON.stringify(responses), completionTime, startedAt, completedAt, ipAddress, userAgent);
  
  // Update response count for the form
  db.prepare(`
    UPDATE form_templates 
    SET response_count = response_count + 1 
    WHERE id = ?
  `).run(formId);
  
  return { success: true };
}

export function getFormResponses(formId, limit = 100) {
  return getDatabase()
    .prepare(`
      SELECT * FROM form_responses 
      WHERE form_id = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `)
    .all(formId, limit);
}

export function getFormAnalytics(formId) {
  const db = getDatabase();
  
  // Get completion rate
  const totalStarted = db.prepare('SELECT COUNT(*) as count FROM form_responses WHERE form_id = ?').get(formId);
  const totalCompleted = db.prepare('SELECT COUNT(*) as count FROM form_responses WHERE form_id = ? AND completed_at IS NOT NULL').get(formId);
  
  // Get average completion time
  const avgTime = db.prepare('SELECT AVG(completion_time) as avg_time FROM form_responses WHERE form_id = ? AND completion_time IS NOT NULL').get(formId);
  
  // Get daily submissions
  const dailyStats = db.prepare(`
    SELECT DATE(started_at) as date, COUNT(*) as count
    FROM form_responses 
    WHERE form_id = ? 
    GROUP BY DATE(started_at)
    ORDER BY date DESC
    LIMIT 30
  `).all(formId);
  
  return {
    totalStarted: totalStarted.count,
    totalCompleted: totalCompleted.count,
    completionRate: totalStarted.count > 0 ? (totalCompleted.count / totalStarted.count * 100).toFixed(2) : 0,
    averageCompletionTime: avgTime.avg_time ? Math.round(avgTime.avg_time) : 0,
    dailyStats
  };
}

// Financial Management Functions
export function addFinancialTransaction(transactionData) {
  const { id, type, amount, description, category, donorName, donorEmail, paymentMethod, transactionDate, createdBy, notes } = transactionData;
  return getDatabase()
    .prepare(`
      INSERT INTO financial_transactions (id, type, amount, description, category, donor_name, donor_email, payment_method, transaction_date, created_by, created_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(id, type, amount, description, category, donorName, donorEmail, paymentMethod, transactionDate, createdBy, new Date().toISOString(), notes);
}

export function getAllFinancialTransactions(limit = 100) {
  return getDatabase()
    .prepare(`
      SELECT * FROM financial_transactions 
      ORDER BY transaction_date DESC 
      LIMIT ?
    `)
    .all(limit);
}

export function getFinancialTransactionsByType(type, limit = 100) {
  return getDatabase()
    .prepare(`
      SELECT * FROM financial_transactions 
      WHERE type = ? 
      ORDER BY transaction_date DESC 
      LIMIT ?
    `)
    .all(type, limit);
}

export function getFinancialSummary(startDate = null, endDate = null) {
  const db = getDatabase();
  let query = `
    SELECT 
      type,
      SUM(amount) as total,
      COUNT(*) as count
    FROM financial_transactions
  `;
  
  const params = [];
  if (startDate && endDate) {
    query += ' WHERE transaction_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }
  
  query += ' GROUP BY type';
  
  return db.prepare(query).all(...params);
}

export function addFinancialCategory(categoryData) {
  const { name, type, description, color } = categoryData;
  return getDatabase()
    .prepare(`
      INSERT INTO financial_categories (name, type, description, color, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(name, type, description, color, new Date().toISOString());
}

export function getAllFinancialCategories() {
  return getDatabase()
    .prepare('SELECT * FROM financial_categories ORDER BY name')
    .all();
}

export function createBudgetPlan(budgetData) {
  const { id, name, period, startDate, endDate, totalBudget, createdBy, notes } = budgetData;
  return getDatabase()
    .prepare(`
      INSERT INTO budget_plans (id, name, period, start_date, end_date, total_budget, created_by, created_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(id, name, period, startDate, endDate, totalBudget, createdBy, new Date().toISOString(), notes);
}

export function getAllBudgetPlans() {
  return getDatabase()
    .prepare('SELECT * FROM budget_plans ORDER BY start_date DESC')
    .all();
}

export function getBudgetPlan(budgetId) {
  return getDatabase()
    .prepare('SELECT * FROM budget_plans WHERE id = ?')
    .get(budgetId);
}

export function addBudgetItem(itemData) {
  const { id, budgetId, categoryId, name, plannedAmount, notes } = itemData;
  return getDatabase()
    .prepare(`
      INSERT INTO budget_items (id, budget_id, category_id, name, planned_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(id, budgetId, categoryId, name, plannedAmount, notes);
}

export function getBudgetItems(budgetId) {
  return getDatabase()
    .prepare(`
      SELECT bi.*, fc.name as category_name, fc.color as category_color
      FROM budget_items bi
      LEFT JOIN financial_categories fc ON bi.category_id = fc.id
      WHERE bi.budget_id = ?
      ORDER BY bi.name
    `)
    .all(budgetId);
}

// Database Health Functions
export function logDatabaseHealth(tableName, recordCount, tableSizeBytes, healthScore, issues = null) {
  return getDatabase()
    .prepare(`
      INSERT INTO database_health_logs (table_name, record_count, table_size_bytes, last_updated, health_score, issues)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(tableName, recordCount, tableSizeBytes, new Date().toISOString(), healthScore, JSON.stringify(issues));
}

export function getDatabaseHealthLogs(limit = 50) {
  return getDatabase()
    .prepare(`
      SELECT * FROM database_health_logs 
      ORDER BY last_updated DESC 
      LIMIT ?
    `)
    .all(limit);
}

export function getDatabaseHealthSummary() {
  const db = getDatabase();
  
  // Get table sizes and record counts
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all();
  
  const healthData = [];
  for (const table of tables) {
    const recordCount = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
    const tableInfo = db.prepare(`PRAGMA table_info(${table.name})`).all();
    const healthResult = calculateTableHealthScore(table.name, recordCount, tableInfo);
    
    healthData.push({
      tableName: table.name,
      recordCount,
      columnCount: tableInfo.length,
      healthScore: healthResult.score,
      issues: healthResult.issues
    });
  }
  
  return healthData;
}

function calculateTableHealthScore(tableName, recordCount, tableInfo) {
  let score = 100;
  const issues = [];
  
  // Check for empty tables (except for certain tables that can be empty)
  if (recordCount === 0 && !['users', 'financial_categories', 'database_health_logs'].includes(tableName)) {
    score -= 20;
    issues.push('Empty table - may indicate data loss or initialization issues');
  }
  
  // Check for tables with too many columns (poor design)
  if (tableInfo.length > 15) {
    score -= 10;
    issues.push(`Too many columns (${tableInfo.length}) - consider normalization`);
  }
  
  // Check for tables with no primary key
  const hasPrimaryKey = tableInfo.some(col => col.pk > 0);
  if (!hasPrimaryKey) {
    score -= 30;
    issues.push('No primary key defined - data integrity risk');
  }
  
  // Check for tables with nullable columns that should be required
  const nullableColumns = tableInfo.filter(col => col.notnull === 0);
  if (nullableColumns.length > 0) {
    const criticalColumns = ['id', 'name', 'title', 'email', 'user_id'];
    const criticalNullable = nullableColumns.filter(col => 
      criticalColumns.some(critical => col.name.toLowerCase().includes(critical))
    );
    if (criticalNullable.length > 0) {
      score -= 15;
      issues.push(`Critical columns are nullable: ${criticalNullable.map(col => col.name).join(', ')}`);
    }
  }
  
  // Check for tables with no indexes (performance issue)
  const indexes = getDatabase().prepare(`PRAGMA index_list(${tableName})`).all();
  if (indexes.length === 0 && recordCount > 100) {
    score -= 10;
    issues.push('No indexes found - may cause performance issues with large datasets');
  }
  
  // Check for potential data type issues
  const textColumns = tableInfo.filter(col => col.type.toLowerCase().includes('text'));
  const largeTextColumns = textColumns.filter(col => 
    col.type.toLowerCase().includes('varchar') && 
    parseInt(col.type.match(/\d+/)?.[0] || '0') > 1000
  );
  if (largeTextColumns.length > 0) {
    score -= 5;
    issues.push(`Large text columns detected - consider using appropriate data types`);
  }
  
  // Check for tables with foreign key constraints (good practice)
  const foreignKeys = getDatabase().prepare(`PRAGMA foreign_key_list(${tableName})`).all();
  if (foreignKeys.length === 0 && tableName !== 'users' && tableInfo.length > 3) {
    score -= 5;
    issues.push('No foreign key constraints - data integrity may be compromised');
  }
  
  return {
    score: Math.max(0, score),
    issues: issues
  };
}

export function removeUserFromEventsDatabase(userId) {
  const db = getDatabase();
  
  try {
    // Remove all RSVPs for this user
    const rsvpResult = db.prepare('DELETE FROM rsvps WHERE user_id = ?').run(userId);
    
    // Remove user from users table if they exist
    const userResult = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    // Remove any applications by this user
    const applicationResult = db.prepare('DELETE FROM applications WHERE user_id = ?').run(userId);
    
    // Remove any LOA requests by this user
    const loaResult = db.prepare('DELETE FROM loa_requests WHERE user_id = ?').run(userId);
    
    // Remove any staff profiles for this user
    const staffProfileResult = db.prepare('DELETE FROM staff_profiles WHERE user_id = ?').run(userId);
    
    console.log(`Removed user ${userId} from events database:`, {
      rsvpsRemoved: rsvpResult.changes,
      userRemoved: userResult.changes,
      applicationsRemoved: applicationResult.changes,
      loaRequestsRemoved: loaResult.changes,
      staffProfilesRemoved: staffProfileResult.changes
    });
    
    return {
      success: true,
      rsvpsRemoved: rsvpResult.changes,
      userRemoved: userResult.changes,
      applicationsRemoved: applicationResult.changes,
      loaRequestsRemoved: loaResult.changes,
      staffProfilesRemoved: staffProfileResult.changes
    };
  } catch (error) {
    console.error(`Error removing user ${userId} from events database:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}
