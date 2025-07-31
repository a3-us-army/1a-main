// commands/list-certs.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getAllCertifications } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("list-certs")
	.setDescription("List all available certifications you can request");

export async function execute(interaction) {
	const certs = getAllCertifications();

	const embed = new EmbedBuilder()
		.setTitle("Available Certifications")
		.setColor(0x3498db)
		.setTimestamp();

	if (certs.length === 0) {
		embed.setDescription("No certifications are available at this time.");
	} else {
		for (const cert of certs) {
			embed.addFields({
				name: cert.name,
				value: cert.description || "No description",
				inline: false,
			});
		}
	}

	await interaction.reply({ embeds: [embed], ephemeral: true });
}