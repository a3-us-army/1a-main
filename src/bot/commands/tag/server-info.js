import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("server-info")
	.setDescription("ArmA-3 server info + Other useful information.")
    .setContexts(0,1,2);

export async function execute(interaction) {
	const embed = new EmbedBuilder()
		.setTitle("Server Information!")
		.addFields(
			{
				name: "Arma Server:",
				// biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
				value: `
**IP**: 192.135.112.202
**Port**: 9020
**Password**: 1A75`,
				inline: true,
			},
            {
				name: "TS Server:",
				// biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
				value: `
**Nickname**: Alpha Company
**IP**: 199.60.101.245:10385
**Password**: 1A75`,
				inline: true,
			},
			{
				name: "Useful Links:",
				// biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
				value: `N/A`,
				inline: true,
			},
		)
		.setColor(0x5865f2);

	await interaction.reply({ embeds: [embed] });
}
