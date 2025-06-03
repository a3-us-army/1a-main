import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabase } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("equipment-deployed")
	.setDescription(
		"Show what approved equipment is deployed and how much in each upcoming event, grouped by location",
	);

export async function execute(interaction) {
	try {
		const db = getDatabase();
		const now = Math.floor(Date.now() / 1000);

		// Get all future events with at least one approved equipment request, including location
		const events = db
			.prepare(`
				SELECT DISTINCT e.id, e.title, e.time, e.location
				FROM events e
				JOIN equipment_requests er ON e.id = er.event_id
				WHERE er.status = 'approved' AND e.time > ?
				ORDER BY e.location ASC, e.time ASC
			`)
			.all(now);

		if (events.length === 0) {
			return await interaction.reply({
				content:
					"No upcoming events are currently using any approved equipment.",
				ephemeral: true,
			});
		}

		// Group events by location
		const grouped = {};
		for (const event of events) {
			const loc = event.location || "No location";
			if (!grouped[loc]) grouped[loc] = [];
			grouped[loc].push(event);
		}

		const embed = new EmbedBuilder()
			.setTitle("Approved Equipment Deployed by Location")
			.setColor(0x3498db)
			.setTimestamp();

		for (const [location, eventsAtLocation] of Object.entries(grouped)) {
			let value = "";
			for (const event of eventsAtLocation) {
				// Get approved equipment for this event
				const equipmentList = db
					.prepare(`
						SELECT e.name, e.category, er.quantity
						FROM equipment_requests er
						JOIN equipment e ON er.equipment_id = e.id
						WHERE er.event_id = ? AND er.status = 'approved'
					`)
					.all(event.id);

				if (equipmentList.length === 0) continue;

				const equipmentLines = equipmentList.map(
					(eq) => `  • **${eq.name}** (${eq.quantity}x) [${eq.category}]`,
				);

				value += `**${event.title}** — <t:${event.time}:F>\n${equipmentLines.join("\n")}\n`;
			}
			if (value.trim().length > 0) {
				embed.addFields({
					name: `📍 ${location}`,
					value: value.trim(),
					inline: false,
				});
			}
		}

		await interaction.reply({ embeds: [embed], ephemeral: false });
	} catch (error) {
		console.error("Error in /equipment-deployed:", error);
		await interaction.reply({
			content: "There was an error retrieving equipment deployment.",
			ephemeral: true,
		});
	}
}
