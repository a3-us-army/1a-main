import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("rate")
	.setDescription(
		"Get a totally real and totally accurate rating of something.",
	)
	.addStringOption((option) =>
		option
			.setName("thing")
			.setDescription("What are you checking for?")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("stat")
			.setDescription("What stat are we checking?")
			.setRequired(true),
	);

export async function execute(interaction) {
	const thing = interaction.options.getString("thing");
	const stat = interaction.options.getString("stat");
	const random = Math.floor(Math.random() * 101);

	await interaction.reply(`${thing} is ${random}% ${stat}`);
}