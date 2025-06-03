import Database from "better-sqlite3";

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This will always resolve to the project root, no matter where you run from:
const dbPath = path.resolve(__dirname, "../../../events.db"); // adjust as needed

let db;

export function setupDatabase() {
	db = new Database(dbPath);

	db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT,
          discord_tag TEXT,
          avatar_url TEXT
        )
      `).run();

	// Ensure the events table has the necessary columns
	db.prepare(`
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
  `).run();

	db.prepare(`
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
      denial_reason TEXT
    )
  `).run();

	// Ensure warnings table exists
	db.prepare(`
    CREATE TABLE IF NOT EXISTS warnings (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT,
      timestamp TEXT NOT NULL
    )
  `).run();

	db.prepare(`
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
  `).run();

	db.prepare(`
    CREATE TABLE IF NOT EXISTS modpacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );
  `).run();

	// Auto-migrate: Ensure required columns exist in the 'events' table
	const requiredColumns = {
		id: "TEXT PRIMARY KEY",
		creator_id: "TEXT",
		title: "TEXT",
		description: "TEXT",
		time: "TEXT",
		location: "TEXT",
		image: "TEXT",
		message_id: "TEXT",
		channel_id: "TEXT",
	};

	// Get current columns in the table
	// biome-ignore lint/style/useConst: <explanation>
	let existingColumns = db
		.prepare("PRAGMA table_info(events)")
		.all()
		.map((col) => col.name);

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
		existingColumns.includes("duration") &&
		existingColumns.includes("location")
	) {
		console.log("Copying 'duration' data to 'location'...");
		db.prepare(
			"UPDATE events SET location = duration WHERE duration IS NOT NULL AND (location IS NULL OR location = '')",
		).run();
	}

	// SAFELY REMOVE 'duration' COLUMN (requires table recreation in SQLite)
	if (existingColumns.includes("duration")) {
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
	db.prepare(`
    CREATE TABLE IF NOT EXISTS rsvps (
      event_id TEXT,
      user_id TEXT,
      status TEXT,
      PRIMARY KEY (event_id, user_id)
    )
  `).run();

	db.prepare(`
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
  `).run();
	setupEquipmentTables();

	return db;
}

// utils/database.js
export function addPersonnel(person) {
	const db = getDatabase();
	db.prepare(`
		INSERT INTO personnel
		(discord_id, discord_username, name, role, status)
		VALUES (?, ?, ?, ?, ?)
	`).run(
		person.discord_id,
		person.discord_username,
		person.name,
		person.role,
		person.status,
	);
}

// Add a warning
export function addWarning(guildId, userId, moderatorId, reason) {
	const id = uuidv4();
	const timestamp = new Date().toISOString();
	getDatabase()
		.prepare(`
      INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
		.run(id, guildId, userId, moderatorId, reason, timestamp);
	return id;
}

// Remove a warning by warning ID
export function removeWarning(warningId) {
	return getDatabase()
		.prepare("DELETE FROM warnings WHERE id = ?")
		.run(warningId);
}

// List all warnings for a user in a guild
export function getWarnings(guildId, userId) {
	return getDatabase()
		.prepare(
			"SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC",
		)
		.all(guildId, userId);
}

// Get a single warning by ID
export function getWarning(warningId) {
	return getDatabase()
		.prepare("SELECT * FROM warnings WHERE id = ?")
		.get(warningId);
}

export function getDatabase() {
	if (!db) {
		setupDatabase();
	}
	return db;
}

import { v4 as uuidv4 } from "uuid";

export function createApplication(app) {
	const id = uuidv4();
	const submitted_at = new Date().toISOString();
	getDatabase()
		.prepare(`
		INSERT INTO applications (
			id, user_id, username, found_unit, steam64, discord_username, unit_name, age, experience, mos, submitted_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
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
			submitted_at,
		);
	return id;
}

export function getApplication(appId) {
	return getDatabase()
		.prepare("SELECT * FROM applications WHERE id = ?")
		.get(appId);
}

export function approveApplication(appId, approverId) {
	return getDatabase()
		.prepare(`
			UPDATE applications
			SET status = 'approved', approved_by = ?, approved_at = ?
			WHERE id = ?
		`)
		.run(approverId, new Date().toISOString(), appId);
}

export function denyApplication(appId, denierId, reason) {
	return getDatabase()
		.prepare(`
			UPDATE applications
			SET status = 'denied', denied_by = ?, denied_at = ?, denial_reason = ?
			WHERE id = ?
		`)
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
		.prepare(`
    INSERT INTO events (id, creator_id, title, description, time, location, image, message_id, channel_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
		.run(
			id,
			creator_id,
			title,
			description,
			time,
			location,
			image,
			message_id,
			channel_id,
		);
}

export function updateRSVP(eventId, userId, status) {
	return getDatabase()
		.prepare(`
    INSERT INTO rsvps (event_id, user_id, status)
    VALUES (?, ?, ?)
    ON CONFLICT(event_id, user_id) DO UPDATE SET status=excluded.status
  `)
		.run(eventId, userId, status);
}

export function getEvent(eventId) {
	return getDatabase()
		.prepare("SELECT * FROM events WHERE id = ?")
		.get(eventId);
}

export function getRSVPs(eventId, status) {
	return getDatabase()
		.prepare("SELECT user_id FROM rsvps WHERE event_id = ? AND status = ?")
		.all(eventId, status);
}

// Setup equipment tables
export function updateEquipmentRequestStatus(eventId, equipmentId, status) {
	return getDatabase()
		.prepare(`
    UPDATE equipment_requests 
    SET status = ? 
    WHERE event_id = ? AND equipment_id = ?
    `)
		.run(status, eventId, equipmentId);
}

export function setupEquipmentTables() {
	const db = getDatabase();

	// Create equipment inventory table
	db.prepare(`
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      available_quantity INTEGER NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'available'
    )
  `).run();

	// Create equipment requests table with request_id included by default
	db.prepare(`
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
  `).run();

	// Check if request_id column exists, add if not
	const columns = db.prepare("PRAGMA table_info(equipment_requests)").all();
	if (!columns.some((col) => col.name === "request_id")) {
		console.log("Adding request_id column to equipment_requests table");
		db.prepare(
			"ALTER TABLE equipment_requests ADD COLUMN request_id TEXT",
		).run();
	}
}

// Equipment inventory operations
export function addEquipment(equipmentData) {
	const { id, name, category, total_quantity, description, status } =
		equipmentData;

	return getDatabase()
		.prepare(`
    INSERT INTO equipment (id, name, category, total_quantity, available_quantity, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
		.run(
			id,
			name,
			category,
			total_quantity,
			total_quantity,
			description,
			status || "available",
		);
}

export function getEquipment(equipmentId) {
	return getDatabase()
		.prepare("SELECT * FROM equipment WHERE id = ?")
		.get(equipmentId);
}

export function getAllEquipment() {
	return getDatabase()
		.prepare("SELECT * FROM equipment ORDER BY category, name")
		.all();
}

export function getAvailableEquipment() {
	return getDatabase()
		.prepare(
			"SELECT * FROM equipment WHERE available_quantity > 0 AND status = 'available' ORDER BY category, name",
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
			.prepare("SELECT available_quantity FROM equipment WHERE id = ?")
			.get(equipment_id);

		if (!equipment || equipment.available_quantity < quantity) {
			throw new Error("Insufficient equipment available");
		}

		// Update available quantity
		db.prepare(
			"UPDATE equipment SET available_quantity = available_quantity - ? WHERE id = ?",
		).run(quantity, equipment_id);

		// Check if the request_id column exists
		const columns = db.prepare("PRAGMA table_info(equipment_requests)").all();
		const hasRequestIdColumn = columns.some((col) => col.name === "request_id");

		// Create or update the request with request_id if the column exists
		if (hasRequestIdColumn && request_id) {
			console.log(`Adding equipment request with ID: ${request_id}`);

			// First check if a request with this event_id and equipment_id already exists
			const existingRequest = db
				.prepare(
					"SELECT * FROM equipment_requests WHERE event_id = ? AND equipment_id = ?",
				)
				.get(event_id, equipment_id);

			if (existingRequest) {
				// Update existing request
				return db
					.prepare(`
            UPDATE equipment_requests 
            SET quantity = quantity + ?, 
                requested_at = ?, 
                status = 'pending',
                request_id = ?
            WHERE event_id = ? AND equipment_id = ?
          `)
					.run(quantity, requested_at, request_id, event_id, equipment_id);
			}
			// Insert new request
			return db
				.prepare(`
            INSERT INTO equipment_requests 
            (event_id, equipment_id, quantity, requested_by, requested_at, status, request_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
				.run(
					event_id,
					equipment_id,
					quantity,
					requested_by,
					requested_at,
					"pending",
					request_id,
				);
		}
		// Use the original query without request_id
		return db
			.prepare(`
          INSERT INTO equipment_requests 
          (event_id, equipment_id, quantity, requested_by, requested_at, status)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(event_id, equipment_id) 
          DO UPDATE SET quantity = quantity + excluded.quantity, 
                        requested_at = excluded.requested_at,
                        status = 'pending'
        `)
			.run(
				event_id,
				equipment_id,
				quantity,
				requested_by,
				requested_at,
				"pending",
			);
	});

	try {
		const result = transaction();

		// Verify the request was added with the request_id
		if (request_id) {
			const addedRequest = db
				.prepare("SELECT * FROM equipment_requests WHERE request_id = ?")
				.get(request_id);
			console.log("Verified added request:", addedRequest);
		}

		return result;
	} catch (error) {
		console.error("Error in requestEquipment transaction:", error);
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
				"SELECT quantity FROM equipment_requests WHERE event_id = ? AND equipment_id = ?",
			)
			.get(eventId, equipmentId);

		if (!request) {
			throw new Error("Equipment request not found");
		}

		// Return the quantity to available
		db.prepare(
			"UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?",
		).run(request.quantity, equipmentId);

		// Delete the request
		return db
			.prepare(
				"DELETE FROM equipment_requests WHERE event_id = ? AND equipment_id = ?",
			)
			.run(eventId, equipmentId);
	});

	return transaction();
}

export function resetEntireInventory() {
	const db = getDatabase();
	db.prepare("UPDATE equipment SET available_quantity = total_quantity").run();
	// Optionally, clear all equipment requests as well:
	db.prepare("DELETE FROM equipment_requests").run();
}

export function resetInventoryForEndedEvents() {
	const db = getDatabase();
	const now = Math.floor(Date.now() / 1000); // assuming event.time is stored as a unix timestamp

	const endedEvents = db
		.prepare("SELECT id FROM events WHERE time <= ?")
		.all(now);

	const transaction = db.transaction(() => {
		for (const event of endedEvents) {
			// Get all equipment requests for this event
			const requests = db
				.prepare(
					"SELECT equipment_id, quantity FROM equipment_requests WHERE event_id = ?",
				)
				.all(event.id);

			// Return each equipment's quantity to available_quantity
			for (const req of requests) {
				db.prepare(
					"UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?",
				).run(req.quantity, req.equipment_id);
			}

			// Delete all equipment requests for this event
			db.prepare("DELETE FROM equipment_requests WHERE event_id = ?").run(
				event.id,
			);
		}
	});

	transaction();
}

export function returnEquipmentForEvent(eventId) {
	const db = getDatabase();
	const requests = db
		.prepare(
			"SELECT equipment_id, quantity FROM equipment_requests WHERE event_id = ?",
		)
		.all(eventId);

	for (const req of requests) {
		db.prepare(
			"UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?",
		).run(req.quantity, req.equipment_id);
	}
}

export function removeEquipment(equipmentId) {
	const db = getDatabase();

	// First, delete all equipment requests for this equipment
	db.prepare("DELETE FROM equipment_requests WHERE equipment_id = ?").run(
		equipmentId,
	);

	// Then, delete the equipment itself
	return db.prepare("DELETE FROM equipment WHERE id = ?").run(equipmentId);
}

export function getEventEquipment(eventId) {
	return getDatabase()
		.prepare(`
    SELECT er.*, e.name, e.category, e.description, e.status as equipment_status
    FROM equipment_requests er
    JOIN equipment e ON er.equipment_id = e.id
    WHERE er.event_id = ?
    ORDER BY e.category, e.name
    `)
		.all(eventId);
}

// New function to get equipment request by request_id
export function getEquipmentRequestByRequestId(requestId) {
	return getDatabase()
		.prepare(`
    SELECT er.*, e.name, e.category, e.description, e.status as equipment_status
    FROM equipment_requests er
    JOIN equipment e ON er.equipment_id = e.id
    WHERE er.request_id = ?
    `)
		.get(requestId);
}

// New function to update equipment request status by request_id
export function updateEquipmentRequestStatusByRequestId(requestId, status) {
	return getDatabase()
		.prepare(`
    UPDATE equipment_requests 
    SET status = ? 
    WHERE request_id = ?
    `)
		.run(status, requestId);
}

export function editEquipment(
	equipmentId,
	{ name, category, quantity, description },
) {
	const db = getDatabase();
	const updates = [];
	const params = [];

	if (name) {
		updates.push("name = ?");
		params.push(name);
	}
	if (category) {
		updates.push("category = ?");
		params.push(category);
	}
	if (quantity) {
		updates.push("total_quantity = ?", "available_quantity = ?");
		params.push(quantity, quantity); // Optionally, only update available_quantity if you want
	}
	if (description) {
		updates.push("description = ?");
		params.push(description);
	}
	if (updates.length === 0) return;

	const sql = `UPDATE equipment SET ${updates.join(", ")} WHERE id = ?`;
	params.push(equipmentId);
	db.prepare(sql).run(...params);
}

// Call this in setupDatabase()
export function setupCertificationTables() {
	const db = getDatabase();

	db.prepare(`
		CREATE TABLE IF NOT EXISTS certifications (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT
		)
	`).run();

	db.prepare(`
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
	`).run();
}

// Add to setupDatabase()
setupCertificationTables();

// Certification operations
export function addCertification({ id, name, description }) {
	return getDatabase()
		.prepare(
			"INSERT INTO certifications (id, name, description) VALUES (?, ?, ?)",
		)
		.run(id, name, description);
}

export function getAllCertifications() {
	return getDatabase()
		.prepare("SELECT * FROM certifications ORDER BY name")
		.all();
}

export function getCertification(certId) {
	return getDatabase()
		.prepare("SELECT * FROM certifications WHERE id = ?")
		.get(certId);
}

export function requestCertification({ user_id, cert_id }) {
	const db = getDatabase();
	const id = uuidv4();
	const requested_at = new Date().toISOString();
	return db
		.prepare(`
		INSERT INTO certification_requests (id, user_id, cert_id, requested_at)
		VALUES (?, ?, ?, ?)
	`)
		.run(id, user_id, cert_id, requested_at);
}

export function getPendingCertificationRequests() {
	return getDatabase()
		.prepare(`
			SELECT cr.*, c.name as cert_name, c.description as cert_description
			FROM certification_requests cr
			JOIN certifications c ON cr.cert_id = c.id
			WHERE cr.status = 'pending'
			ORDER BY cr.requested_at ASC
		`)
		.all();
}

export function getCertificationRequest(requestId) {
	return getDatabase()
		.prepare(`
			SELECT cr.*, c.name as cert_name, c.description as cert_description
			FROM certification_requests cr
			JOIN certifications c ON cr.cert_id = c.id
			WHERE cr.id = ?
		`)
		.get(requestId);
}

export function approveCertificationRequest(requestId, adminId) {
	const db = getDatabase();
	return db
		.prepare(`
		UPDATE certification_requests
		SET status = 'approved', approved_by = ?, approved_at = ?
		WHERE id = ?
	`)
		.run(adminId, new Date().toISOString(), requestId);
}

export function denyCertificationRequest(requestId, adminId, reason) {
	const db = getDatabase();
	return db
		.prepare(`
		UPDATE certification_requests
		SET status = 'denied', denied_by = ?, denied_at = ?, denial_reason = ?
		WHERE id = ?
	`)
		.run(adminId, new Date().toISOString(), reason, requestId);
}

export function getUserCertifications(userId) {
	return getDatabase()
		.prepare(`
			SELECT c.name, c.description, cr.approved_at
			FROM certification_requests cr
			JOIN certifications c ON cr.cert_id = c.id
			WHERE cr.user_id = ? AND cr.status = 'approved'
			ORDER BY cr.approved_at DESC
		`)
		.all(userId);
}

export function editCertification(certId, newName, newDescription) {
	const db = getDatabase();
	if (newName && newDescription) {
		db.prepare(
			"UPDATE certifications SET name = ?, description = ? WHERE id = ?",
		).run(newName, newDescription, certId);
	} else if (newName) {
		db.prepare("UPDATE certifications SET name = ? WHERE id = ?").run(
			newName,
			certId,
		);
	} else if (newDescription) {
		db.prepare("UPDATE certifications SET description = ? WHERE id = ?").run(
			newDescription,
			certId,
		);
	}
}

export function deleteCertification(certId) {
	const db = getDatabase();
	// Delete all requests for this cert first
	db.prepare("DELETE FROM certification_requests WHERE cert_id = ?").run(
		certId,
	);
	// Then delete the cert itself
	db.prepare("DELETE FROM certifications WHERE id = ?").run(certId);
}

export function getUserCertRequestStatus(userId, certId) {
	const db = getDatabase();
	return db
		.prepare(
			"SELECT status FROM certification_requests WHERE user_id = ? AND cert_id = ? ORDER BY requested_at DESC LIMIT 1",
		)
		.get(userId, certId);
}
