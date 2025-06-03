import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("event-times")
	.setDescription("Our op times.");

export async function execute(interaction) {
	await interaction.reply(
		"**Saturday:** 8:00 PM EST | <t:1747699200:t>\n\n**Sunday:** 8:00 PM EST | <t:1747699200:t>",
	);
}
