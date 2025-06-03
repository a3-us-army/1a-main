import { getDatabase } from "./database.js";
import { sendAutomaticReminder } from "../commands/events/remind-event.js";

// Store reminders that have already been sent to avoid duplicates
const sentReminders = new Set();

// Check for upcoming events and send reminders
export async function checkAndSendReminders(client) {
	try {
		const db = getDatabase();
		const currentTime = Math.floor(Date.now() / 1000);

		// 30-minute reminder window
		const thirtyMinTime = currentTime + 1800;
		const thirtyMinStart = thirtyMinTime - 120;
		const thirtyMinEnd = thirtyMinTime + 120;

		// Event start reminder window
		const startTime = currentTime;
		const startWindowStart = startTime - 120;
		const startWindowEnd = startTime + 120;

		// Get events for 30-minute reminders
		const events30m = db
			.prepare(`
				SELECT * FROM events 
				WHERE time BETWEEN ? AND ?
				ORDER BY time ASC
			`)
			.all(thirtyMinStart, thirtyMinEnd);

		// Get events for start-time reminders
		const eventsStart = db
			.prepare(`
				SELECT * FROM events 
				WHERE time BETWEEN ? AND ?
				ORDER BY time ASC
			`)
			.all(startWindowStart, startWindowEnd);

		// 30-minute reminders
		for (const event of events30m) {
			const reminderKey = `reminder_30m_${event.id}`;
			if (sentReminders.has(reminderKey)) continue;

			console.log(
				`Sending 30-minute reminder for event: ${event.title} (${event.id})`,
			);
			await sendAutomaticReminder(client, event, { minutes: 30 });

			sentReminders.add(reminderKey);

			try {
				db.prepare(`
					CREATE TABLE IF NOT EXISTS sent_reminders (
						event_id TEXT,
						reminder_type TEXT,
						sent_at INTEGER,
						PRIMARY KEY (event_id, reminder_type)
					)
				`).run();

				db.prepare(`
					INSERT OR REPLACE INTO sent_reminders (event_id, reminder_type, sent_at)
					VALUES (?, ?, ?)
				`).run(event.id, "30m", currentTime);
			} catch (dbError) {
				console.error("Error recording 30m sent reminder:", dbError);
			}
		}

		// Start-time reminders
		for (const event of eventsStart) {
			const reminderKey = `reminder_start_${event.id}`;
			if (sentReminders.has(reminderKey)) continue;

			console.log(
				`Sending start-time reminder for event: ${event.title} (${event.id})`,
			);
			await sendAutomaticReminder(client, event, { minutes: 0 });

			sentReminders.add(reminderKey);

			try {
				db.prepare(`
					CREATE TABLE IF NOT EXISTS sent_reminders (
						event_id TEXT,
						reminder_type TEXT,
						sent_at INTEGER,
						PRIMARY KEY (event_id, reminder_type)
					)
				`).run();

				db.prepare(`
					INSERT OR REPLACE INTO sent_reminders (event_id, reminder_type, sent_at)
					VALUES (?, ?, ?)
				`).run(event.id, "start", currentTime);
			} catch (dbError) {
				console.error("Error recording start-time sent reminder:", dbError);
			}
		}
	} catch (error) {
		console.error("Error checking for event reminders:", error);
	}
}

// Load already sent reminders from database on startup
function loadSentReminders() {
	try {
		const db = getDatabase();

		// Drop the old table if it exists (only needed once)
		db.prepare("DROP TABLE IF EXISTS sent_reminders").run();

		// Create the new table with the correct schema
		db.prepare(`
			CREATE TABLE IF NOT EXISTS sent_reminders (
				event_id TEXT,
				reminder_type TEXT,
				sent_at INTEGER,
				PRIMARY KEY (event_id, reminder_type)
			)
		`).run();

		const existingReminders = db
			.prepare("SELECT event_id, reminder_type FROM sent_reminders")
			.all();

		for (const reminder of existingReminders) {
			sentReminders.add(
				`reminder_${reminder.reminder_type}_${reminder.event_id}`,
			);
		}

		console.log(`Loaded ${existingReminders.length} previously sent reminders`);

		// Clean up old reminders (older than 24 hours)
		const cleanupTime = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
		db.prepare("DELETE FROM sent_reminders WHERE sent_at < ?").run(cleanupTime);
	} catch (error) {
		console.error("Error loading sent reminders:", error);
	}
}

// Initialize the reminder system
export function setupReminderSystem(client) {
	loadSentReminders();

	let reminderInterval = null;
	if (reminderInterval) {
		clearInterval(reminderInterval);
	}

	reminderInterval = setInterval(
		() => checkAndSendReminders(client),
		60 * 1000,
	);

	console.log("Event reminder system initialized");
}
