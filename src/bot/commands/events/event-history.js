import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabase } from "../../utils/database.js";

// Command definition
export const data = new SlashCommandBuilder()
	.setName("event-history")
	.setDescription("Show past events with attendance statistics")
	.addIntegerOption((option) =>
		option
			.setName("limit")
			.setDescription("Number of past events to show (default: 5, max: 20)")
			.setRequired(false)
			.setMinValue(1)
			.setMaxValue(20),
	);

// Command execution
export async function execute(interaction) {
	try {
		// Get the limit parameter (default to 5)
		const limit = interaction.options.getInteger("limit") || 5;
		const db = getDatabase();
		const currentTime = Math.floor(Date.now() / 1000); // Current time in Unix timestamp

		// Query the database for past events
		const events = db
			.prepare(`
      SELECT id, title, description, time, location, creator_id, channel_id, message_id
      FROM events
      WHERE time < ?
      ORDER BY time DESC
      LIMIT ?
    `)
			.all(currentTime, limit);

		if (events.length === 0) {
			return await interaction.reply({
				content: "There are no past events in the database.",
				ephemeral: true,
			});
		}

		// Defer the reply as this might take some time if there are many events
		await interaction.deferReply();

		// Create an embed to display the events
		const embed = new EmbedBuilder()
			.setTitle("Event History")
			.setColor(0x9b59b6) // Purple color for history
			.setDescription(`Showing the last ${events.length} past events:`)
			.setTimestamp();

		// Process each event and add it to the embed
		for (const event of events) {
			// Get RSVP statistics for this event
			const attendingCount = db
				.prepare(
					"SELECT COUNT(*) as count FROM rsvps WHERE event_id = ? AND status = ?",
				)
				.get(event.id, "yes").count;

			const maybeCount = db
				.prepare(
					"SELECT COUNT(*) as count FROM rsvps WHERE event_id = ? AND status = ?",
				)
				.get(event.id, "maybe").count;

			const declinedCount = db
				.prepare(
					"SELECT COUNT(*) as count FROM rsvps WHERE event_id = ? AND status = ?",
				)
				.get(event.id, "no").count;

			const totalRSVPs = attendingCount + maybeCount + declinedCount;

			// Format the date
			const eventDate = `<t:${event.time}:F>`;

			// Create field for this event
			let eventValue = `**When**: ${eventDate}\n`;
			eventValue += `**Location**: ${event.location || "Not specified"}\n`;
			eventValue += `**Created by**: <@${event.creator_id}>\n`;
			eventValue += `**Attendance**: ${attendingCount} attended, ${maybeCount} maybe, ${declinedCount} declined\n`;

			// Add participation rate if there were any RSVPs
			if (totalRSVPs > 0) {
				const participationRate = Math.round(
					(attendingCount / totalRSVPs) * 100,
				);
				eventValue += `**Participation Rate**: ${participationRate}%\n`;
			}

			// Add link to original message if available
			if (event.channel_id && event.message_id) {
				eventValue += `[View Original Event](https://discord.com/channels/${interaction.guildId}/${event.channel_id}/${event.message_id})`;
			}

			embed.addFields({
				name: `${event.title} (ID: ${event.id})`,
				value: eventValue,
				inline: false,
			});
		}

		// Add a footer with the total count
		embed.setFooter({
			text: `Showing ${events.length} of ${
				db
					.prepare("SELECT COUNT(*) as count FROM events WHERE time < ?")
					.get(currentTime).count
			} past events`,
		});

		// Send the embed
		await interaction.editReply({ embeds: [embed] });
	} catch (error) {
		console.error("Error executing event-history command:", error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({
				content: "There was an error fetching the event history.",
				ephemeral: true,
			});
		} else {
			await interaction.editReply({
				content: "There was an error fetching the event history.",
			});
		}
	}
}