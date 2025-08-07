import { getDatabase } from './database.js';
import { sendAutomaticReminder } from '../commands/events/remind-event.js';
import { EmbedBuilder } from 'discord.js';

// Store reminders that have already been sent to avoid duplicates
const sentReminders = new Set();

// Function to send DM reminders to "maybe" users
async function sendMaybeReminder(client, event, hoursBefore) {
  try {
    const db = getDatabase();
    
    // Get users who RSVP'd "maybe"
    const maybeUsers = db
      .prepare("SELECT user_id FROM rsvps WHERE event_id = ? AND status = 'maybe'")
      .all(event.id);

    if (maybeUsers.length === 0) {
      return; // No "maybe" users to remind
    }

    const time = Math.floor(event.time);
    const hoursText = hoursBefore === 24 ? '24 hours' : '12 hours';

    // Create the reminder embed
    const reminderEmbed = new EmbedBuilder()
      .setTitle(`RSVP Reminder: ${event.title}`)
      .setColor(0xf39c12) // Orange color for maybe reminders
      .setDescription(
        `You selected "maybe" for this event that's starting in ${hoursText}. Please update your RSVP to help with planning!`
      )
      .addFields(
        {
          name: '📅 When',
          value: `<t:${time}:F> (<t:${time}:R>)`,
          inline: true,
        },
        {
          name: '📍 Location',
          value: event.location || 'Not specified',
          inline: true,
        }
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
        name: '🔗 Event Link',
        value: `[Jump to Event](https://discord.com/channels/${event.guild_id || client.guilds.cache.first().id}/${event.channel_id}/${event.message_id})`,
        inline: false,
      });
    }

    // Send DM to each "maybe" user
    for (const user of maybeUsers) {
      try {
        const discordUser = await client.users.fetch(user.user_id);
        await discordUser.send({ embeds: [reminderEmbed] });
        console.log(`Sent ${hoursBefore}h maybe reminder to user ${user.user_id} for event ${event.id}`);
      } catch (dmError) {
        console.error(`Failed to send ${hoursBefore}h maybe reminder to user ${user.user_id}:`, dmError);
      }
    }

  } catch (error) {
    console.error(`Error sending ${hoursBefore}h maybe reminder for event ${event.id}:`, error);
  }
}

// Check for upcoming events and send reminders
export async function checkAndSendReminders(client) {
  try {
    const db = getDatabase();
    const currentTime = Math.floor(Date.now() / 1000);

    // 24-hour reminder window for maybe users
    const twentyFourHourTime = currentTime + 24 * 60 * 60;
    const twentyFourHourStart = twentyFourHourTime - 120;
    const twentyFourHourEnd = twentyFourHourTime + 120;

    // 12-hour reminder window for maybe users
    const twelveHourTime = currentTime + 12 * 60 * 60;
    const twelveHourStart = twelveHourTime - 120;
    const twelveHourEnd = twelveHourTime + 120;

    // 30-minute reminder window
    const thirtyMinTime = currentTime + 1800;
    const thirtyMinStart = thirtyMinTime - 120;
    const thirtyMinEnd = thirtyMinTime + 120;

    // Event start reminder window
    const startTime = currentTime;
    const startWindowStart = startTime - 120;
    const startWindowEnd = startTime + 120;

    // Get events for 24-hour maybe reminders
    const events24h = db
      .prepare(
        `
				SELECT * FROM events 
				WHERE time BETWEEN ? AND ?
				ORDER BY time ASC
			`
      )
      .all(twentyFourHourStart, twentyFourHourEnd);

    // Get events for 12-hour maybe reminders
    const events12h = db
      .prepare(
        `
				SELECT * FROM events 
				WHERE time BETWEEN ? AND ?
				ORDER BY time ASC
			`
      )
      .all(twelveHourStart, twelveHourEnd);

    // Get events for 30-minute reminders
    const events30m = db
      .prepare(
        `
				SELECT * FROM events 
				WHERE time BETWEEN ? AND ?
				ORDER BY time ASC
			`
      )
      .all(thirtyMinStart, thirtyMinEnd);

    // Get events for start-time reminders
    const eventsStart = db
      .prepare(
        `
				SELECT * FROM events 
				WHERE time BETWEEN ? AND ?
				ORDER BY time ASC
			`
      )
      .all(startWindowStart, startWindowEnd);

    // 24-hour maybe reminders
    for (const event of events24h) {
      const reminderKey = `reminder_24h_maybe_${event.id}`;
      if (sentReminders.has(reminderKey)) continue;

      console.log(
        `Sending 24-hour maybe reminder for event: ${event.title} (${event.id})`
      );
      await sendMaybeReminder(client, event, 24);

      sentReminders.add(reminderKey);

      try {
        db.prepare(
          `
					CREATE TABLE IF NOT EXISTS sent_reminders (
						event_id TEXT,
						reminder_type TEXT,
						sent_at INTEGER,
						PRIMARY KEY (event_id, reminder_type)
					)
				`
        ).run();

        db.prepare(
          `
					INSERT OR REPLACE INTO sent_reminders (event_id, reminder_type, sent_at)
					VALUES (?, ?, ?)
				`
        ).run(event.id, '24h_maybe', currentTime);
      } catch (dbError) {
        console.error('Error recording 24h maybe sent reminder:', dbError);
      }
    }

    // 12-hour maybe reminders
    for (const event of events12h) {
      const reminderKey = `reminder_12h_maybe_${event.id}`;
      if (sentReminders.has(reminderKey)) continue;

      console.log(
        `Sending 12-hour maybe reminder for event: ${event.title} (${event.id})`
      );
      await sendMaybeReminder(client, event, 12);

      sentReminders.add(reminderKey);

      try {
        db.prepare(
          `
					CREATE TABLE IF NOT EXISTS sent_reminders (
						event_id TEXT,
						reminder_type TEXT,
						sent_at INTEGER,
						PRIMARY KEY (event_id, reminder_type)
					)
				`
        ).run();

        db.prepare(
          `
					INSERT OR REPLACE INTO sent_reminders (event_id, reminder_type, sent_at)
					VALUES (?, ?, ?)
				`
        ).run(event.id, '12h_maybe', currentTime);
      } catch (dbError) {
        console.error('Error recording 12h maybe sent reminder:', dbError);
      }
    }

    // 30-minute reminders
    for (const event of events30m) {
      const reminderKey = `reminder_30m_${event.id}`;
      if (sentReminders.has(reminderKey)) continue;

      console.log(
        `Sending 30-minute reminder for event: ${event.title} (${event.id})`
      );
      await sendAutomaticReminder(client, event, { minutes: 30 });

      sentReminders.add(reminderKey);

      try {
        db.prepare(
          `
					CREATE TABLE IF NOT EXISTS sent_reminders (
						event_id TEXT,
						reminder_type TEXT,
						sent_at INTEGER,
						PRIMARY KEY (event_id, reminder_type)
					)
				`
        ).run();

        db.prepare(
          `
					INSERT OR REPLACE INTO sent_reminders (event_id, reminder_type, sent_at)
					VALUES (?, ?, ?)
				`
        ).run(event.id, '30m', currentTime);
      } catch (dbError) {
        console.error('Error recording 30m sent reminder:', dbError);
      }
    }

    // Start-time reminders
    for (const event of eventsStart) {
      const reminderKey = `reminder_start_${event.id}`;
      if (sentReminders.has(reminderKey)) continue;

      console.log(
        `Sending start-time reminder for event: ${event.title} (${event.id})`
      );
      await sendAutomaticReminder(client, event, { minutes: 0 });

      sentReminders.add(reminderKey);

      try {
        db.prepare(
          `
					CREATE TABLE IF NOT EXISTS sent_reminders (
						event_id TEXT,
						reminder_type TEXT,
						sent_at INTEGER,
						PRIMARY KEY (event_id, reminder_type)
					)
				`
        ).run();

        db.prepare(
          `
					INSERT OR REPLACE INTO sent_reminders (event_id, reminder_type, sent_at)
					VALUES (?, ?, ?)
				`
        ).run(event.id, 'start', currentTime);
      } catch (dbError) {
        console.error('Error recording start-time sent reminder:', dbError);
      }
    }
  } catch (error) {
    console.error('Error checking for event reminders:', error);
  }
}

// Load already sent reminders from database on startup
function loadSentReminders() {
  try {
    const db = getDatabase();

    // Drop the old table if it exists (only needed once)
    db.prepare('DROP TABLE IF EXISTS sent_reminders').run();

    // Create the new table with the correct schema
    db.prepare(
      `
			CREATE TABLE IF NOT EXISTS sent_reminders (
				event_id TEXT,
				reminder_type TEXT,
				sent_at INTEGER,
				PRIMARY KEY (event_id, reminder_type)
			)
		`
    ).run();

    const existingReminders = db
      .prepare('SELECT event_id, reminder_type FROM sent_reminders')
      .all();

    for (const reminder of existingReminders) {
      sentReminders.add(
        `reminder_${reminder.reminder_type}_${reminder.event_id}`
      );
    }

    console.log(`Loaded ${existingReminders.length} previously sent reminders`);

    // Clean up old reminders (older than 24 hours)
    const cleanupTime = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    db.prepare('DELETE FROM sent_reminders WHERE sent_at < ?').run(cleanupTime);
  } catch (error) {
    console.error('Error loading sent reminders:', error);
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
    60 * 1000
  );

  console.log('Event reminder system initialized');
}
