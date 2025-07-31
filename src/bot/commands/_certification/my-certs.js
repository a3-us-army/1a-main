// commands/my-certs.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUserCertifications } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("my-certs")
	.setDescription("List your approved certifications");

export async function execute(interaction) {
	const certs = getUserCertifications(interaction.user.id);

	const embed = new EmbedBuilder()
		.setTitle("Your Certifications")
		.setColor(0x2ecc71)
		.setTimestamp();

	if (certs.length === 0) {
		embed.setDescription("You have no approved certifications.");
	} else {
		const certList = certs
			.map(
				(cert, idx) =>
					`${idx + 1}. **${cert.name}**\n${cert.description || "No description"}\nApproved: <t:${Math.floor(new Date(cert.approved_at).getTime() / 1000)}:F>`,
			)
			.join("\n\n");

		embed.setDescription(certList);
	}

	await interaction.reply({ embeds: [embed], ephemeral: false });
}