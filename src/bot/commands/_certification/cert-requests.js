// commands/admin/cert-requests.js
import {
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} from "discord.js";
import { getPendingCertificationRequests } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("cert-requests")
	.setDescription("List all pending certification requests (admin only)");

export async function execute(interaction) {
	if (!interaction.member.permissions.has("ADMINISTRATOR")) {
		return interaction.reply({
			content: "You do not have permission.",
			ephemeral: true,
		});
	}

	const requests = getPendingCertificationRequests();

	if (requests.length === 0) {
		return interaction.reply({
			content: "There are no pending certification requests.",
			ephemeral: true,
		});
	}

	for (const req of requests) {
		const embed = new EmbedBuilder()
			.setTitle("Certification Request")
			.setDescription(`User: <@${req.user_id}>`)
			.addFields(
				{ name: "Certification", value: req.cert_name, inline: true },
				{
					name: "Description",
					value: req.cert_description || "No description",
					inline: false,
				},
				{
					name: "Requested At",
					value: `<t:${Math.floor(new Date(req.requested_at).getTime() / 1000)}:F>`,
					inline: true,
				},
				{ name: "Request ID", value: req.id, inline: true },
			)
			.setColor(0xffa500);

		const approveBtn = new ButtonBuilder()
			.setCustomId(`cert_approve_${req.id}`)
			.setLabel("Approve")
			.setStyle(ButtonStyle.Success);

		const denyBtn = new ButtonBuilder()
			.setCustomId(`cert_deny_${req.id}`)
			.setLabel("Deny")
			.setStyle(ButtonStyle.Danger);

		const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);

		await interaction.channel.send({ embeds: [embed], components: [row] });
	}

	await interaction.reply({
		content: "Pending certification requests have been posted above.",
		ephemeral: true,
	});
}