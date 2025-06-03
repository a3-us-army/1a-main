import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("server-info")
	.setDescription("ArmA-3 server info + Other useful information.");

export async function execute(interaction) {
	const embed = new EmbedBuilder()
		.setTitle("Server Information!")
		.addFields(
			{
				name: "TS/Arma Server:",
				// biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
				value: `N/A`,
				inline: true,
			},
			{
				name: "Useful Links:",
				// biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
				value: `N/A`,
				inline: true,
			},
			{
				name: "Radio Frequencies:",
				// biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
				value: `N/A`,
				inline: true,
			},
		)
		.setColor(0x5865f2);

	await interaction.reply({ embeds: [embed] });
}
