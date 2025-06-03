import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("avatar")
	.setDescription("Show a user's avatar.")
	.addUserOption((opt) =>
		opt
			.setName("user")
			.setDescription("User to get avatar of")
			.setRequired(false),
	);

export async function execute(interaction) {
	const user = interaction.options.getUser("user") || interaction.user;
	const embed = new EmbedBuilder()
		.setTitle(`${user.username}'s Avatar`)
		.setImage(user.displayAvatarURL({ size: 512 }))
		.setColor(0x5865f2);
	await interaction.reply({ embeds: [embed], ephemeral: false });
}