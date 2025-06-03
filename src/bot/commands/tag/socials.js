import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("socials")
	.setDescription("The US Army social media accounts.");

export async function execute(interaction) {
	await interaction.reply("N/A");
}
