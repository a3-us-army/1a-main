import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabase } from "../../utils/database.js";

// Command definition
export const data = new SlashCommandBuilder()
	.setName("list-events")
	.setDescription("List all upcoming events.")
	.addStringOption((option) =>
		option
			.setName("location")
			.setDescription("Filter events by location")
			.setRequired(false)
			.setAutocomplete(true),
	);

// Command execution
export async function execute(interaction) {
	try {
		const db = getDatabase();
		const currentTime = Math.floor(Date.now() / 1000);

		const location = interaction.options.getString("location");

		let events;
		if (location) {
			events = db
				.prepare(`
					SELECT id, title, description, time, location
					FROM events
					WHERE time > ? AND location = ?
					ORDER BY time ASC
					LIMIT 10
				`)
				.all(currentTime, location);
		} else {
			events = db
				.prepare(`
					SELECT id, title, description, time, location
					FROM events
					WHERE time > ?
					ORDER BY time ASC
					LIMIT 10
				`)
				.all(currentTime);
		}

		if (events.length === 0) {
			return await interaction.reply({
				content: location
					? `There are no upcoming events at **${location}**.`
					: "There are no upcoming events.",
				ephemeral: true,
			});
		}

		const embed = new EmbedBuilder()
			.setTitle("Upcoming Events")
			.setColor(0x5865f2)
			.setDescription(
				location
					? `Here are the upcoming events at **${location}**:`
					: "Here are the upcoming events:",
			)
			.setTimestamp();

		events.forEach((event, index) => {
			embed.addFields({
				name: `${index + 1}. ${event.title}`,
				value: `**When**: <t:${event.time}:F> (<t:${event.time}:R>)\n**Location**: ${event.location || "Not specified"}\n**ID**: \`${event.id}\``,
			});
		});

		await interaction.reply({ embeds: [embed] });
	} catch (error) {
		console.error("Error executing list-events command:", error);
		await interaction.reply({
			content: "There was an error fetching the events.",
			ephemeral: true,
		});
	}
}

// Autocomplete handler for location
export async function autocomplete(interaction) {
	try {
		const focusedValue = interaction.options.getFocused().toLowerCase();
		const db = getDatabase();

		// Get all unique locations for future events
		const locations = db
			.prepare(`
				SELECT DISTINCT location
				FROM events
				WHERE time > ?
				ORDER BY location ASC
			`)
			.all(Math.floor(Date.now() / 1000))
			.map((row) => row.location)
			.filter((loc) => loc && loc.trim().length > 0);

		const filtered = locations.filter((loc) =>
			loc.toLowerCase().includes(focusedValue),
		);

		await interaction.respond(
			filtered.slice(0, 25).map((loc) => ({ name: loc, value: loc })),
		);
	} catch (error) {
		console.error("Error in location autocomplete:", error);
		await interaction.respond([]);
	}
}