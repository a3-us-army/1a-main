import {
	EmbedBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from "discord.js";
import {
	updateRSVP,
	getEvent,
	getRSVPs,
	getDatabase,
	getEquipment,
	updateEquipmentRequestStatus,
	getCertificationRequest,
	approveCertificationRequest,
	denyCertificationRequest,
} from "../utils/database.js";
import { createEmbed } from "../utils/utils.js";
import { buildEventEmbed } from "../../utils/rsvp_embed.js";
import { handleLOAButton } from "./loaButtonHandler.js";

export async function handleButtonInteraction(interaction) {
	const { customId } = interaction;

	// Handle RSVP buttons
	if (customId.startsWith("rsvp_")) {
		await handleRSVPButton(interaction);
	}
	// Handle equipment approval buttons
	else if (customId.startsWith("app_eq_")) {
		await handleEquipmentApprovalButton(interaction);
	}
	// Handle equipment denial buttons
	else if (customId.startsWith("den_eq_")) {
		await handleEquipmentDenialButton(interaction);
	}
	// Handle equipment list check button
	else if (customId.startsWith("check_equipment_")) {
		await handleEquipmentButtonClick(interaction);
	}
	// Handle certification approval button
	else if (customId.startsWith("cert_approve_")) {
		await handleCertApprovalButton(interaction);
	}
	// Handle certification denial button (show modal)
	else if (customId.startsWith("cert_deny_")) {
		await handleCertDenialButton(interaction);
	} else if (
		interaction.customId.startsWith("loa_approve_") ||
		interaction.customId.startsWith("loa_deny_")
	) {
		await handleLOAButton(interaction);
		return;
	}
}

async function handleRSVPButton(interaction) {
	const [, eventId, status] = interaction.customId.split("_");
	const userId = interaction.user.id;

	try {
		updateRSVP(eventId, userId, status);

		const goingUsers = getRSVPs(eventId, "yes");
		const notGoingUsers = getRSVPs(eventId, "no");
		const maybeUsers = getRSVPs(eventId, "maybe");

		const event = getEvent(eventId);

		// --- ENSURE DESCRIPTION IS NON-EMPTY ---
		if (!event.description || !event.description.trim()) {
			event.description = "No description provided.";
		}

		// --- FIX: Ensure event.time is an integer ---
		event.time = Math.floor(Number(event.time));

		const rsvps = { goingUsers, notGoingUsers, maybeUsers };
		const { embed, components } = buildEventEmbed(event, rsvps);

		const message = await interaction.message.channel.messages.fetch(
			interaction.message.id,
		);
		await message.edit({ embeds: [embed], components });
		await interaction.deferUpdate();
	} catch (error) {
		console.error("Error handling RSVP button interaction:", error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({
				content: "There was an error with your RSVP.",
				ephemeral: true,
			});
		}
	}
}

async function handleEquipmentApprovalButton(interaction) {
	const requestId = interaction.customId.replace("app_eq_", "");

	try {
		const db = getDatabase();
		const request = db
			.prepare("SELECT * FROM equipment_requests WHERE request_id = ?")
			.get(requestId);

		if (!request) {
			return interaction.reply({
				content: "Equipment request not found.",
				ephemeral: true,
			});
		}

		const eventId = request.event_id;
		const equipmentId = request.equipment_id;

		if (request.status !== "pending") {
			return interaction.reply({
				content: `This equipment request has already been ${request.status}.`,
				ephemeral: true,
			});
		}

		const event = getEvent(eventId);
		const equipment = getEquipment(equipmentId);

		updateEquipmentRequestStatus(eventId, equipmentId, "approved");

		const approvalEmbed = createEmbed({
			title: "Equipment Request Approved",
			description: `Equipment request for event: **${event.title}** has been approved`,
			fields: [
				{
					name: "Equipment",
					value: equipment.name,
					inline: true,
				},
				{
					name: "Quantity",
					value: request.quantity.toString(),
					inline: true,
				},
				{
					name: "Category",
					value: equipment.category,
					inline: true,
				},
				{
					name: "Requested By",
					value: `<@${request.requested_by}>`,
					inline: true,
				},
				{
					name: "Approved By",
					value: `<@${interaction.user.id}>`,
					inline: true,
				},
				{
					name: "Event Date",
					value: `<t:${event.time}:F> (<t:${event.time}:R>)`,
					inline: true,
				},
			],
			color: 0x2ecc71,
		});

		await interaction.update({
			embeds: [approvalEmbed],
			components: [],
		});

		try {
			const requester = await interaction.client.users.fetch(
				request.requested_by,
			);
			await requester.send({
				content: `Your equipment request for ${equipment.name} has been approved for event "${event.title}"`,
				embeds: [approvalEmbed],
			});
		} catch (error) {
			console.error("Could not notify requester:", error);
		}
	} catch (error) {
		console.error("Error approving equipment:", error);
		await interaction.reply({
			content: `Error: ${error.message}`,
			ephemeral: true,
		});
	}
}

async function handleEquipmentDenialButton(interaction) {
	const requestId = interaction.customId.replace("den_eq_", "");

	try {
		const modal = new ModalBuilder()
			.setCustomId(`deny_r_${requestId}`)
			.setTitle("Denial Reason");

		const reasonInput = new TextInputBuilder()
			.setCustomId("denial_reason")
			.setLabel("Reason for denying this equipment request")
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(true);

		const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
		modal.addComponents(firstActionRow);

		await interaction.showModal(modal);
	} catch (error) {
		console.error("Error showing denial modal:", error);
		await interaction.reply({
			content: `Error: ${error.message}`,
			ephemeral: true,
		});
	}
}

async function handleEquipmentButtonClick(interaction) {
	try {
		await interaction.deferReply({ ephemeral: true });

		const eventId = interaction.customId.replace("check_equipment_", "");
		const db = getDatabase();

		const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);

		if (!event) {
			return await interaction.editReply({
				content: "This event no longer exists.",
			});
		}

		const equipment = db
			.prepare(`
				SELECT er.*, e.name, e.category, e.description 
				FROM equipment_requests er
				JOIN equipment e ON er.equipment_id = e.id
				WHERE er.event_id = ?
			`)
			.all(eventId);

		if (equipment.length === 0) {
			return await interaction.editReply({
				content: "No equipment has been requested for this event.",
			});
		}

		const groupedEquipment = {};
		for (const item of equipment) {
			if (!groupedEquipment[item.category]) {
				groupedEquipment[item.category] = [];
			}
			groupedEquipment[item.category].push(item);
		}

		const equipmentEmbed = new EmbedBuilder()
			.setTitle(`Equipment for: ${event.title}`)
			.setColor(0x3498db)
			.setDescription(
				"The following equipment has been requested for this event:",
			)
			.setFooter({ text: `Event ID: ${event.id}` });

		for (const [category, items] of Object.entries(groupedEquipment)) {
			equipmentEmbed.addFields({
				name: `📋 ${category}`,
				value: items
					.map(
						(item) => `• **${item.name}** (${item.quantity}x) - ${item.status}`,
					)
					.join("\n"),
				inline: false,
			});
		}

		await interaction.editReply({
			embeds: [equipmentEmbed],
		});
	} catch (error) {
		console.error("Error handling equipment button click:", error);
		try {
			if (!interaction.deferred && !interaction.replied) {
				await interaction.reply({
					content: "There was an error retrieving the equipment list.",
					ephemeral: true,
				});
			} else {
				await interaction.editReply({
					content: "There was an error retrieving the equipment list.",
				});
			}
		} catch (err) {
			console.error("Failed to send error message to user:", err);
		}
	}
}

async function handleCertApprovalButton(interaction) {
	const requestId = interaction.customId.replace("cert_approve_", "");
	const req = getCertificationRequest(requestId);

	if (!req) {
		return interaction.reply({
			content: "Certification request not found.",
			ephemeral: true,
		});
	}

	approveCertificationRequest(requestId, interaction.user.id);

	const embed = new EmbedBuilder()
		.setTitle("Certification Approved")
		.setDescription(
			`Certification **${req.cert_name}** for <@${req.user_id}> has been approved.`,
		)
		.addFields({
			name: "Approved By",
			value: `<@${interaction.user.id}>`,
			inline: true,
		})
		.setColor(0x2ecc71);

	await interaction.update({ embeds: [embed], components: [] });

	// Optionally DM the user
	try {
		const user = await interaction.client.users.fetch(req.user_id);
		await user.send(
			`Your certification request for **${req.cert_name}** has been approved!`,
		);
	} catch (e) {}
}

async function handleCertDenialButton(interaction) {
	const requestId = interaction.customId.replace("cert_deny_", "");
	try {
		const modal = new ModalBuilder()
			.setCustomId(`cert_deny_modal_${requestId}`)
			.setTitle("Denial Reason");

		const reasonInput = new TextInputBuilder()
			.setCustomId("denial_reason")
			.setLabel("Reason for denying this certification request")
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(true);

		const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
		modal.addComponents(firstActionRow);

		await interaction.showModal(modal);
	} catch (error) {
		console.error("Error showing cert denial modal:", error);
		await interaction.reply({
			content: `Error: ${error.message}`,
			ephemeral: true,
		});
	}
}

// Modal handler for cert denial (add to your modal handler file)
export async function handleModalSubmit(interaction) {
	if (interaction.customId.startsWith("cert_deny_modal_")) {
		const requestId = interaction.customId.replace("cert_deny_modal_", "");
		const reason = interaction.fields.getTextInputValue("denial_reason");
		const req = getCertificationRequest(requestId);

		if (!req) {
			return interaction.reply({
				content: "Request not found.",
				ephemeral: true,
			});
		}

		denyCertificationRequest(requestId, interaction.user.id, reason);

		const embed = new EmbedBuilder()
			.setTitle("Certification Denied")
			.setDescription(
				`Certification **${req.cert_name}** for <@${req.user_id}> has been denied.`,
			)
			.addFields(
				{ name: "Denied By", value: `<@${interaction.user.id}>`, inline: true },
				{ name: "Reason", value: reason, inline: false },
			)
			.setColor(0xe74c3c);

		await interaction.update({ embeds: [embed], components: [] });

		// Optionally DM the user
		try {
			const user = await interaction.client.users.fetch(req.user_id);
			await user.send(
				`Your certification request for **${req.cert_name}** was denied.\nReason: ${reason}`,
			);
		} catch (e) {}
	}
}
