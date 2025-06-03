import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("ship")
	.setDescription("Ship two users and see their compatibility!")
	.addUserOption((opt) =>
		opt.setName("user1").setDescription("First user").setRequired(true),
	)
	.addUserOption((opt) =>
		opt.setName("user2").setDescription("Second user").setRequired(true),
	);

export async function execute(interaction) {
	const user1 = interaction.options.getUser("user1");
	const user2 = interaction.options.getUser("user2");
	const percent = Math.floor(Math.random() * 101);
	let emoji = "💖";
	if (percent < 30) emoji = "💔";
	else if (percent < 70) emoji = "💞";
	await interaction.reply(
		`${user1} + ${user2} = ${percent}% compatible! ${emoji}`,
	);
}