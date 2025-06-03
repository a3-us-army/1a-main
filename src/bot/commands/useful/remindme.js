import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("remindme")
	.setDescription("Set a personal reminder.")
	.addStringOption((opt) =>
		opt
			.setName("time")
			.setDescription("When to remind you (e.g., 10m, 2h, 1d)")
			.setRequired(true),
	)
	.addStringOption((opt) =>
		opt
			.setName("message")
			.setDescription("What should I remind you?")
			.setRequired(true),
	);

function parseTime(str) {
	const match = str.match(/^(\d+)([smhd])$/i);
	if (!match) return null;
	const num = Number.parseInt(match[1]);
	const unit = match[2].toLowerCase();
	switch (unit) {
		case "s":
			return num * 1000;
		case "m":
			return num * 60 * 1000;
		case "h":
			return num * 60 * 60 * 1000;
		case "d":
			return num * 24 * 60 * 60 * 1000;
		default:
			return null;
	}
}

export async function execute(interaction) {
	const timeStr = interaction.options.getString("time");
	const message = interaction.options.getString("message");
	const ms = parseTime(timeStr);

	if (!ms || ms < 1000 || ms > 30 * 24 * 60 * 60 * 1000) {
		return interaction.reply({
			content: "Please specify a valid time (e.g., 10m, 2h, 1d, max 30d).",
			ephemeral: true,
		});
	}

	await interaction.reply({
		content: `⏰ I will remind you in ${timeStr}: "${message}"`,
		ephemeral: true,
	});

	setTimeout(() => {
		interaction.user.send(`⏰ Reminder: ${message}`);
	}, ms);
}