import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabase } from "../../utils/database.js";

// Command definition
export const data = new SlashCommandBuilder()
	.setName("event-info")
	.setDescription("Get detailed information about a specific event")
	.addStringOption((option) =>
		option
			.setName("id")
			.setDescription("The ID of the event to view")
			.setRequired(true)
			.setAutocomplete(true),
	);

// Command execution
export async function execute(interaction) {
	try {
		const eventId = interaction.options.getString("id");
		const db = getDatabase();

		// Get event information
		const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);

		if (!event) {
			return await interaction.reply({
				content: `No event found with ID: \`${eventId}\``,
				ephemeral: true,
			});
		}

		// Get RSVP counts
		const attendingCount = db
			.prepare(
				"SELECT COUNT(*) as count FROM rsvps WHERE event_id = ? AND status = ?",
			)
			.get(eventId, "yes").count;

		const maybeCount = db
			.prepare(
				"SELECT COUNT(*) as count FROM rsvps WHERE event_id = ? AND status = ?",
			)
			.get(eventId, "maybe").count;

		const declinedCount = db
			.prepare(
				"SELECT COUNT(*) as count FROM rsvps WHERE event_id = ? AND status = ?",
			)
			.get(eventId, "no").count;

		// Get the list of attendees
		const attendees = db
			.prepare(
				"SELECT user_id, status FROM rsvps WHERE event_id = ? ORDER BY status",
			)
			.all(eventId);

		// Create an embed to display the event details
		const embed = new EmbedBuilder()
			.setTitle(event.title)
			.setColor(0x5865f2)
			.setDescription(event.description || "*No description provided*")
			.addFields(
				{
					name: "📅 Date & Time",
					value: `<t:${event.time}:F> (<t:${event.time}:R>)`,
					inline: true,
				},
				{
					name: "📍 Location",
					value: event.location || "Not specified",
					inline: true,
				},
				{
					name: "👤 Created By",
					value: `<@${event.creator_id}>`,
					inline: true,
				},
				{
					name: "📊 RSVP Status",
					value: `<:checkmark:1365157872685547540> Attending: ${attendingCount}\n<:question:1365157901450346536> Maybe: ${maybeCount}\n<:x_:1365157886908567592> Declined: ${declinedCount}`,
					inline: false,
				},
			)
			.setFooter({ text: `Event ID: ${event.id}` })
			.setTimestamp();

		// Add image if it exists
		if (event.image) {
			embed.setImage(event.image);
		}

		// Format attendees by status
		if (attendees.length > 0) {
			// We'll use Discord user mentions instead of usernames
			const attending = attendees
				.filter((a) => a.status === "yes")
				.map((a) => `<@${a.user_id}>`);

			const maybe = attendees
				.filter((a) => a.status === "maybe")
				.map((a) => `<@${a.user_id}>`);

			const declined = attendees
				.filter((a) => a.status === "no")
				.map((a) => `<@${a.user_id}>`);

			// Format attendee lists
			let attendeeText = "";

			if (attending.length > 0) {
				attendeeText += `<:checkmark:1365157872685547540> **Attending (${attending.length})**: ${attending.join(", ")}\n\n`;
			}

			if (maybe.length > 0) {
				attendeeText += `<:question:1365157901450346536> **Maybe (${maybe.length})**: ${maybe.join(", ")}\n\n`;
			}

			if (declined.length > 0) {
				attendeeText += `<:x_:1365157886908567592> **Declined (${declined.length})**: ${declined.join(", ")}`;
			}

			// Truncate if too long
			if (attendeeText.length > 1024) {
				attendeeText = `${attendeeText.substring(0, 1020)}...`;
			}

			if (attendeeText) {
				embed.addFields({
					name: "👥 Attendees",
					value: attendeeText,
					inline: false,
				});
			}
		}

		// Add link to original message if available
		if (event.channel_id && event.message_id) {
			embed.addFields({
				name: "🔗 Event Link",
				value: `[Jump to Event](https://discord.com/channels/${interaction.guildId}/${event.channel_id}/${event.message_id})`,
				inline: false,
			});
		}

		// Send the embed
		await interaction.reply({ embeds: [embed] });
	} catch (error) {
		console.error("Error executing event-info command:", error);
		await interaction.reply({
			content: "There was an error fetching the event information.",
			ephemeral: true,
		});
	}
}

// Autocomplete handler
export async function autocomplete(interaction) {
	try {
		const focusedValue = interaction.options.getFocused().toLowerCase();
		const db = getDatabase();
		const currentTime = Math.floor(Date.now() / 1000);

		// Get upcoming events
		const events = db
			.prepare(`
        SELECT id, title, time 
        FROM events 
        ORDER BY time ASC 
        LIMIT 25
      `)
			.all();

		// Filter events based on user input (matching either ID or title)
		const filtered = events.filter(
			(event) =>
				event.id.toLowerCase().includes(focusedValue) ||
				event.title.toLowerCase().includes(focusedValue),
		);

		// Format the choices for autocomplete
		const choices = filtered.map((event) => {
			// Format time as relative time (e.g., "in 2 days")
			const timeString = `<t:${event.time}:R>`;

			return {
				name: `${event.title} (${timeString}) - ID: ${event.id}`,
				value: event.id,
			};
		});

		// Respond with the choices (max 25)
		await interaction.respond(choices.slice(0, 25));
	} catch (error) {
		console.error("Error handling autocomplete:", error);
		// Provide empty results in case of error
		await interaction.respond([]);
	}
}