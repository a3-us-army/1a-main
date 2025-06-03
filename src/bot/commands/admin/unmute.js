import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("unmute")
	.setDescription("Remove timeout from a member (unmute)")
	.addStringOption((opt) =>
		opt
			.setName("user")
			.setDescription("User to unmute (username, tag, or ID)")
			.setRequired(true)
			.setAutocomplete(true),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
	const userInput = interaction.options.getString("user");

	// Try to find the member by ID, username, or tag
	let member;
	try {
		member =
			interaction.guild.members.cache.get(userInput) ||
			interaction.guild.members.cache.find(
				(m) =>
					m.user.tag.toLowerCase().includes(userInput.toLowerCase()) ||
					m.user.username.toLowerCase().includes(userInput.toLowerCase()),
			) ||
			null;
	} catch {
		member = null;
	}

	if (!member) {
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Unmute Failed")
			.setDescription("User not found or not in this server.");
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	// Check if the member is timed out
	if (
		!member.communicationDisabledUntilTimestamp ||
		member.communicationDisabledUntilTimestamp < Date.now()
	) {
		const embed = new EmbedBuilder()
			.setColor(0xe67e22)
			.setTitle("Unmute Failed")
			.setDescription("This user is not currently muted (timed out).");
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	await member.timeout(null, "Unmuted by admin");
	const embed = new EmbedBuilder()
		.setColor(0x2ecc71)
		.setTitle("User Unmuted")
		.addFields({
			name: "User",
			value: `${member.user.tag} (<@${member.user.id}>)`,
			inline: true,
		})
		.setTimestamp();
	await interaction.reply({ embeds: [embed] });
}

export async function autocomplete(interaction) {
	const focused = interaction.options.getFocused().toLowerCase();

	// Get all members who are currently timed out
	await interaction.guild.members.fetch(); // Ensure cache is populated
	const mutedMembers = interaction.guild.members.cache.filter(
		(m) =>
			m.communicationDisabledUntilTimestamp &&
			m.communicationDisabledUntilTimestamp > Date.now(),
	);

	// Filter by input (username, tag, or ID)
	const choices = mutedMembers
		.filter(
			(m) =>
				m.user.tag.toLowerCase().includes(focused) ||
				m.user.username.toLowerCase().includes(focused) ||
				m.user.id.startsWith(focused),
		)
		.map((m) => ({
			name: `${m.user.tag} (${m.user.id})`,
			value: m.user.id,
		}))
		.slice(0, 25); // Discord allows max 25 choices

	await interaction.respond(choices);
}
