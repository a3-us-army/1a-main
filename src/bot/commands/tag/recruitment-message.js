import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("recruitment-message")
	.setDescription("The recruitment message.");

export async function execute(interaction) {
	await interaction.reply("N/A");
}