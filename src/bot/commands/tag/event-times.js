import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("event-times")
	.setDescription("Our op times.")
    .setContexts(0,1,2);

export async function execute(interaction) {
	await interaction.reply(
		"**Saturday:** <t:1747699200:t>\n\n**Sunday:** <t:1747699200:t> \n\n *All of these are your timezone*",
	);
}
