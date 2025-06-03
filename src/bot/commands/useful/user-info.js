import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("user-info")
	.setDescription("Show information about a user.")
	.addUserOption((opt) =>
		opt
			.setName("user")
			.setDescription("User to get info about")
			.setRequired(false),
	);

export async function execute(interaction) {
	const user = interaction.options.getUser("user") || interaction.user;
	const member = interaction.guild
		? await interaction.guild.members.fetch(user.id)
		: null;

	const embed = new EmbedBuilder()
		.setTitle(`User Info: ${user.tag}`)
		.setThumbnail(user.displayAvatarURL({ size: 256 }))
		.setColor(0x5865f2)
		.addFields(
			{ name: "Username", value: user.username, inline: true },
			{ name: "User ID", value: user.id, inline: true },
			{ name: "Bot?", value: user.bot ? "Yes" : "No", inline: true },
			{
				name: "Created",
				value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
				inline: true,
			},
		);

	if (member) {
		embed.addFields(
			{
				name: "Joined Server",
				value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`,
				inline: true,
			},
			{
				name: "Roles",
				value:
					member.roles.cache
						.filter((r) => r.id !== interaction.guild.id)
						.map((r) => `<@&${r.id}>`)
						.join(", ") || "None",
				inline: false,
			},
		);
	}

	await interaction.reply({ embeds: [embed], ephemeral: false });
}
