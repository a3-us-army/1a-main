import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUserCertifications } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("user-certs")
	.setDescription("List another user's approved certifications")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user whose certifications you want to view")
			.setRequired(true),
	);

export async function execute(interaction) {
	const user = interaction.options.getUser("user");
	const certs = getUserCertifications(user.id);

	const embed = new EmbedBuilder()
		.setTitle(`${user.username}'s Certifications`)
		.setColor(0x2ecc71)
		.setTimestamp();

	if (certs.length === 0) {
		embed.setDescription("This user has no approved certifications.");
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
