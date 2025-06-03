import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("reverse")
	.setDescription("Reverse your text!")
	.addStringOption((opt) =>
		opt.setName("text").setDescription("Text to reverse").setRequired(true),
	);

export async function execute(interaction) {
	const text = interaction.options.getString("text");
	const reversed = text.split("").reverse().join("");
	await interaction.reply(`🔄 ${reversed}`);
}