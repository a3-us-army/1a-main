import { getDatabase } from "../../utils/database.js";
import {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("remind-event")
	.setDescription("Create a new event.")
	.addStringOption((option) =>
		option
			.setName("id")
			.setDescription("The ID of the event to delete")
			.setRequired(true)
			.setAutocomplete(true),
	);

// Store reminders that have already been sent to avoid duplicates
const sentReminders = new Set();

// Function to send automatic reminders
export async function sendAutomaticReminder(client, event, options = {}) {
	try {
		const db = getDatabase();

		// Get the list of attendees who RSVP'd "yes"
		const attendees = db
			.prepare(
				"SELECT user_id FROM rsvps WHERE event_id = ? AND status = 'yes'",
			)
			.all(event.id);

		if (attendees.length === 0) {
			return; // No attendees to remind
		}

		// Determine reminder timing for the message
		let timingText = "starting soon!";
		if (options.minutes === 30) {
			timingText = "starting in 30 minutes!";
		} else if (options.minutes === 0) {
			timingText = "starting now!";
		}

		const time = Math.floor(event.time);

		// Create the reminder embed
		const reminderEmbed = new EmbedBuilder()
			.setTitle(`Reminder: ${event.title}`)
			.setColor(0xf1c40f) // Yellow color for reminders
			.setDescription(
				`This is an automatic reminder that your event is ${timingText}`,
			)
			.addFields(
				{
					name: "📅 When",
					value: `<t:${time}:F> (<t:${time}:R>)`,
					inline: true,
				},
				{
					name: "📍 Location",
					value: event.location || "Not specified",
					inline: true,
				},
			)
			.setFooter({ text: `Event ID: ${event.id}` })
			.setTimestamp();

		// Add image if it exists
		if (event.image) {
			reminderEmbed.setImage(event.image);
		}

		// Add link to original message if available
		if (event.channel_id && event.message_id) {
			reminderEmbed.addFields({
				name: "🔗 Event Link",
				value: `[Jump to Event](https://discord.com/channels/${event.guild_id || client.guilds.cache.first().id}/${event.channel_id}/${event.message_id})`,
				inline: false,
			});
		}

		// Create a button to check equipment list
		const equipmentButton = new ButtonBuilder()
			.setCustomId(`check_equipment_${event.id}`)
			.setLabel("Check Equipment List")
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder().addComponents(equipmentButton);

		// Create a list of user mentions
		const mentions = attendees.map((a) => `<@${a.user_id}>`).join(" ");

		// Get the channel to send the reminder to
		const channel = await client.channels.fetch(event.channel_id);
		if (!channel) return;

		// Send the reminder
		await channel.send({
			content: "**Automatic Event Reminder!** <@&1363609382700712129>",
			embeds: [reminderEmbed],
			components: [row],
		});

		console.log(
			`Sent automatic reminder for event: ${event.title} (${event.id})`,
		);
	} catch (error) {
		console.error(
			`Error sending automatic reminder for event ${event.id}:`,
			error,
		);
	}
}

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
