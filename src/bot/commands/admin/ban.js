import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("ban")
	.setDescription("Ban a member from the server")
	.addUserOption((opt) =>
		opt.setName("user").setDescription("User to ban").setRequired(true),
	)
	.addStringOption((opt) =>
		opt.setName("reason").setDescription("Reason").setRequired(false),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
	const user = interaction.options.getUser("user");
	const reason =
		interaction.options.getString("reason") || "No reason provided";
	const member = await interaction.guild.members
		.fetch(user.id)
		.catch(() => null);

	if (!member) {
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Ban Failed")
			.setDescription("User not found.");
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}
	if (!member.bannable) {
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Ban Failed")
			.setDescription("I can't ban this user.");
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}
	await member.ban({ reason });
	const embed = new EmbedBuilder()
		.setColor(0xc0392b)
		.setTitle("User Banned")
		.addFields(
			{ name: "User", value: `${user.tag} (<@${user.id}>)`, inline: true },
			{ name: "Reason", value: reason, inline: true },
		)
		.setTimestamp();
	await interaction.reply({ embeds: [embed] });
}