import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("say")
	.setDescription("Make the bot say something.")
	.addStringOption((opt) =>
		opt.setName("text").setDescription("Text to say").setRequired(true),
	);

export async function execute(interaction) {
	const text = interaction.options.getString("text");
	await interaction.reply(text);
}
