import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabase } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("attendance")
	.setDescription("Show the attendance for an event")
	.addStringOption((option) =>
		option
			.setName("event-id")
			.setDescription("The ID of the event")
			.setRequired(true)
			.setAutocomplete(true),
	);

export async function execute(interaction) {
	const eventId = interaction.options.getString("event-id");
	const db = getDatabase();

	// Get event info
	const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
	if (!event) {
		return interaction.reply({
			content: "Event not found.",
			ephemeral: true,
		});
	}

	// Get RSVPs
	const attending = db
		.prepare("SELECT user_id FROM rsvps WHERE event_id = ? AND status = 'yes'")
		.all(eventId);
	const maybe = db
		.prepare(
			"SELECT user_id FROM rsvps WHERE event_id = ? AND status = 'maybe'",
		)
		.all(eventId);
	const declined = db
		.prepare("SELECT user_id FROM rsvps WHERE event_id = ? AND status = 'no'")
		.all(eventId);

	const embed = new EmbedBuilder()
		.setTitle(`Attendance for: ${event.title}`)
		.setColor(0x5865f2)
		.addFields(
			{
				name: `<:checkmark:1365157872685547540> Attending (${attending.length})`,
				value:
					attending.length > 0
						? attending.map((u) => `<@${u.user_id}>`).join("\n")
						: "No one",
				inline: true,
			},
			{
				name: `<:question:1365157901450346536> Maybe (${maybe.length})`,
				value:
					maybe.length > 0
						? maybe.map((u) => `<@${u.user_id}>`).join("\n")
						: "No one",
				inline: true,
			},
			{
				name: `<:x_:1365157886908567592> Not Attending (${declined.length})`,
				value:
					declined.length > 0
						? declined.map((u) => `<@${u.user_id}>`).join("\n")
						: "No one",
				inline: true,
			},
		)
		.setFooter({ text: `Event ID: ${eventId}` })
		.setTimestamp();

	await interaction.reply({ embeds: [embed], ephemeral: false });
}

// Autocomplete handler for event-id
export async function autocomplete(interaction) {
	try {
		const focusedValue = interaction.options.getFocused().toLowerCase();
		const db = getDatabase();
		const currentTime = Math.floor(Date.now() / 1000);

		const events = db
			.prepare(`
				SELECT id, title, time 
				FROM events 
				WHERE time > ? 
				ORDER BY time ASC 
				LIMIT 25
			`)
			.all(currentTime);

		const filtered = events.filter(
			(event) =>
				event.id.toLowerCase().includes(focusedValue) ||
				event.title.toLowerCase().includes(focusedValue),
		);

		const choices = filtered.map((event) => {
			const timeString = `<t:${event.time}:R>`;
			return {
				name: `${event.title} (${timeString}) - ID: ${event.id}`,
				value: event.id,
			};
		});

		await interaction.respond(choices.slice(0, 25));
	} catch (error) {
		console.error("Error handling autocomplete:", error);
		await interaction.respond([]);
	}
}
