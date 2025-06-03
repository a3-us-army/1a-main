import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
} from "discord.js";

// Helper for duration parsing
function parseDuration(str) {
	const match = str.match(/^(\d+)([smhd])$/);
	if (!match) return null;
	const num = Number.parseInt(match[1]);
	switch (match[2]) {
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

export const data = new SlashCommandBuilder()
	.setName("mute")
	.setDescription("Timeout a member (mute)")
	.addUserOption((opt) =>
		opt.setName("user").setDescription("User to mute").setRequired(true),
	)
	.addStringOption((opt) =>
		opt
			.setName("duration")
			.setDescription("Duration (e.g. 10m, 1h)")
			.setRequired(true),
	)
	.addStringOption((opt) =>
		opt.setName("reason").setDescription("Reason").setRequired(false),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
	const user = interaction.options.getUser("user");
	const durationStr = interaction.options.getString("duration");
	const reason =
		interaction.options.getString("reason") || "No reason provided";
	const member = await interaction.guild.members
		.fetch(user.id)
		.catch(() => null);

	const ms = parseDuration(durationStr);
	if (!member) {
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Mute Failed")
			.setDescription("User not found.");
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}
	if (!ms || ms < 5000 || ms > 28 * 24 * 60 * 60 * 1000) {
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Mute Failed")
			.setDescription("Invalid duration. Use s/m/h/d (e.g. 10m, 1h).");
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}
	await member.timeout(ms, reason);
	const embed = new EmbedBuilder()
		.setColor(0x95a5a6)
		.setTitle("User Muted")
		.addFields(
			{ name: "User", value: `${user.tag} (<@${user.id}>)`, inline: true },
			{ name: "Duration", value: durationStr, inline: true },
			{ name: "Reason", value: reason, inline: true },
		)
		.setTimestamp();
	await interaction.reply({ embeds: [embed] });
}
