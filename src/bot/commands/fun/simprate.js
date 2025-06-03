import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("simprate")
	.setDescription("How much of a simp is someone?")
	.addUserOption((opt) =>
		opt.setName("user").setDescription("User to rate").setRequired(true),
	);

export async function execute(interaction) {
	const user = interaction.options.getUser("user");
	const percent = Math.floor(Math.random() * 101);
	let emoji = "😏";
	if (percent > 80) emoji = "💗";
	else if (percent < 20) emoji = "🧊";
	await interaction.reply(`${user} is ${percent}% simp! ${emoji}`);
}