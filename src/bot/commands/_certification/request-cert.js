import {
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} from "discord.js";
import {
	getAllCertifications,
	requestCertification,
	getCertification,
	getPendingCertificationRequests,
	getUserCertRequestStatus,
} from "../../utils/database.js";

const CERT_REQUEST_CHANNEL_ID = process.env.FORMS_CHANNEL_ID;

export const data = new SlashCommandBuilder()
	.setName("request-cert")
	.setDescription("Request a certification")
	.addStringOption((opt) =>
		opt
			.setName("certification")
			.setDescription("Certification to request")
			.setRequired(true)
			.setAutocomplete(true),
	);

export async function autocomplete(interaction) {
	const focused = interaction.options.getFocused().toLowerCase();
	const certs = getAllCertifications();
	const choices = certs
		.filter((cert) => cert.name.toLowerCase().includes(focused))
		.map((cert) => ({ name: cert.name, value: cert.id }));
	await interaction.respond(choices.slice(0, 25));
}

export async function execute(interaction) {
	const certId = interaction.options.getString("certification");
	const cert = getCertification(certId);

	if (!cert) {
		return interaction.reply({
			content: "Certification not found.",
			ephemeral: true,
		});
	}

	// Prevent duplicate requests
	const existing = getUserCertRequestStatus(interaction.user.id, certId);
	if (
		existing &&
		(existing.status === "pending" || existing.status === "approved")
	) {
		return interaction.reply({
			content: `You already have a certification request for **${cert.name}** that is ${existing.status}.`,
			ephemeral: true,
		});
	}

	try {
		const req = requestCertification({
			user_id: interaction.user.id,
			cert_id: certId,
		});

		await interaction.reply({
			content: `Your request for **${cert.name}** has been submitted and is pending admin review.`,
			ephemeral: true,
		});

		// Post in the configured channel with approve/deny buttons
		if (CERT_REQUEST_CHANNEL_ID) {
			const channel = await interaction.client.channels.fetch(
				CERT_REQUEST_CHANNEL_ID,
			);
			if (channel?.isTextBased()) {
				const pendingRequests = getPendingCertificationRequests();
				const thisReq = pendingRequests.find(
					(r) => r.user_id === interaction.user.id && r.cert_id === certId,
				);

				const requestId = thisReq
					? thisReq.id
					: req.lastInsertRowid || "unknown";

				const embed = new EmbedBuilder()
					.setTitle("Certification Request")
					.setDescription(`User: <@${interaction.user.id}>`)
					.addFields(
						{ name: "Certification", value: cert.name, inline: true },
						{
							name: "Description",
							value: cert.description || "No description",
							inline: false,
						},
						{
							name: "Requested At",
							value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
							inline: true,
						},
						{ name: "Request ID", value: requestId, inline: true },
					)
					.setColor(0xffa500);

				const approveBtn = new ButtonBuilder()
					.setCustomId(`cert_approve_${requestId}`)
					.setLabel("Approve")
					.setStyle(ButtonStyle.Success);

				const denyBtn = new ButtonBuilder()
					.setCustomId(`cert_deny_${requestId}`)
					.setLabel("Deny")
					.setStyle(ButtonStyle.Danger);

				const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);

				await channel.send({ embeds: [embed], components: [row] });
			}
		}
	} catch (error) {
		console.error("Error requesting certification:", error);
		await interaction.reply({
			content: "There was an error submitting your request.",
			ephemeral: true,
		});
	}
}
