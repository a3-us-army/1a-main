import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("roll")
	.setDescription("Roll a die or dice.")
	.addIntegerOption((opt) =>
		opt
			.setName("sides")
			.setDescription("Number of sides")
			.setRequired(true)
			.setMinValue(2),
	)
	.addIntegerOption((opt) =>
		opt
			.setName("times")
			.setDescription("How many dice? (default 1)")
			.setMinValue(1),
	);

export async function execute(interaction) {
	const sides = interaction.options.getInteger("sides");
	const times = interaction.options.getInteger("times") || 1;
	const rolls = Array.from({ length: times }, () =>
		Math.ceil(Math.random() * sides),
	);
	await interaction.reply(`🎲 You rolled: ${rolls.join(", ")}`);
} 