import {
	SlashCommandBuilder,
	ChannelType,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import {
	getEvent,
	requestEquipment,
	removeEquipmentRequest,
	getEventEquipment,
	getAllEquipment,
	getAvailableEquipment,
	getEquipment,
	getDatabase,
	updateEquipmentRequestStatus,
	getEquipmentRequestByRequestId,
	updateEquipmentRequestStatusByRequestId,
} from "../../utils/database.js";
import { createEmbed } from "../../utils/utils.js";

// Add a configuration option for the equipment request channel
const EQUIPMENT_REQUEST_CHANNEL_ID = process.env.FORMS_CHANNEL_ID || "";

export const data = new SlashCommandBuilder()
	.setName("equipment-request")
	.setDescription("Manage equipment requests for events")
	.addSubcommand((subcommand) =>
		subcommand
			.setName("add")
			.setDescription("Request equipment for an event")
			.addStringOption((option) =>
				option
					.setName("event-id")
					.setDescription("The ID of the event")
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName("equipment-id")
					.setDescription("The ID of the equipment")
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addIntegerOption((option) =>
				option
					.setName("quantity")
					.setDescription("Quantity of equipment needed")
					.setRequired(true)
					.setMinValue(1),
			)
			.addChannelOption((option) =>
				option
					.setName("channel")
					.setDescription(
						"Channel to post the equipment request (defaults to configured channel)",
					)
					.addChannelTypes(ChannelType.GuildText)
					.setRequired(false),
			),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName("remove")
			.setDescription("Remove equipment from an event")
			.addStringOption((option) =>
				option
					.setName("event-id")
					.setDescription("The ID of the event")
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName("equipment-id")
					.setDescription("The ID of the equipment")
					.setRequired(true)
					.setAutocomplete(true),
			),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName("list")
			.setDescription("List all equipment for an event")
			.addStringOption((option) =>
				option
					.setName("event-id")
					.setDescription("The ID of the event")
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addChannelOption((option) =>
				option
					.setName("channel")
					.setDescription(
						"Channel to post the equipment list (defaults to current channel)",
					)
					.addChannelTypes(ChannelType.GuildText)
					.setRequired(false),
			),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName("approve")
			.setDescription("Approve an equipment request")
			.addStringOption((option) =>
				option
					.setName("event-id")
					.setDescription("The ID of the event")
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName("equipment-id")
					.setDescription("The ID of the equipment")
					.setRequired(true)
					.setAutocomplete(true),
			),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName("deny")
			.setDescription("Deny an equipment request")
			.addStringOption((option) =>
				option
					.setName("event-id")
					.setDescription("The ID of the event")
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName("equipment-id")
					.setDescription("The ID of the equipment")
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName("reason")
					.setDescription("Reason for denial")
					.setRequired(false),
			),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName("pending")
			.setDescription("List all pending equipment requests")
			.addChannelOption((option) =>
				option
					.setName("channel")
					.setDescription(
						"Channel to post the pending requests (defaults to current channel)",
					)
					.addChannelTypes(ChannelType.GuildText)
					.setRequired(false),
			),
	);

export async function execute(interaction) {
	const subcommand = interaction.options.getSubcommand();

	try {
		switch (subcommand) {
			case "add":
				await handleAddEquipment(interaction);
				break;
			case "remove":
				await handleRemoveEquipment(interaction);
				break;
			case "list":
				await handleListEquipment(interaction);
				break;
			case "approve":
				await handleApproveEquipment(interaction);
				break;
			case "deny":
				await handleDenyEquipment(interaction);
				break;
			case "pending":
				await handlePendingRequests(interaction);
				break;
		}
	} catch (error) {
		console.error("Error handling equipment request:", error);
		await interaction.reply({
			content: `Error: ${error.message}`,
			ephemeral: true,
		});
	}
}

async function handleAddEquipment(interaction) {
	const eventId = interaction.options.getString("event-id");
	const equipmentId = interaction.options.getString("equipment-id");
	const quantity = interaction.options.getInteger("quantity");
	const userId = interaction.user.id;
	const targetChannel =
		interaction.options.getChannel("channel") ||
		(EQUIPMENT_REQUEST_CHANNEL_ID
			? interaction.client.channels.cache.get(EQUIPMENT_REQUEST_CHANNEL_ID)
			: null);

	// Verify event exists
	const event = getEvent(eventId);
	if (!event) {
		return interaction.reply({
			content: "Event not found.",
			ephemeral: true,
		});
	}

	// Verify equipment exists
	const equipment = getEquipment(equipmentId);
	if (!equipment) {
		return interaction.reply({
			content: "Equipment not found.",
			ephemeral: true,
		});
	}

	try {
		// Check if there's already a request for this event and equipment
		const db = getDatabase();
		const existingRequest = db
			.prepare(
				"SELECT * FROM equipment_requests WHERE event_id = ? AND equipment_id = ?",
			)
			.get(eventId, equipmentId);

		if (existingRequest) {
			return interaction.reply({
				content: `There is already a request for ${equipment.name} for event "${event.title}". Please use the remove command first if you want to change the quantity.`,
				ephemeral: true,
			});
		}

		// Generate a unique request ID (shorter to avoid string length issues)
		const requestId = Date.now().toString().slice(-10);
		console.log(
			`Generated request ID: ${requestId} for equipment ${equipment.name} for event ${event.title}`,
		);

		// Check if the database has the request_id column
		const columns = db.prepare("PRAGMA table_info(equipment_requests)").all();
		const hasRequestIdColumn = columns.some((col) => col.name === "request_id");
		console.log(`Database has request_id column: ${hasRequestIdColumn}`);

		// If the column doesn't exist, add it
		if (!hasRequestIdColumn) {
			console.log("Adding request_id column to equipment_requests table");
			try {
				db.prepare(
					"ALTER TABLE equipment_requests ADD COLUMN request_id TEXT",
				).run();
				console.log("Column added successfully");
			} catch (error) {
				console.error("Error adding request_id column:", error);
			}
		}

		// Insert the equipment request directly with SQL to ensure request_id is set
		console.log(`Adding equipment request with ID: ${requestId}`);

		// Check if equipment is available in sufficient quantity
		const availableEquipment = db
			.prepare("SELECT available_quantity FROM equipment WHERE id = ?")
			.get(equipmentId);

		if (
			!availableEquipment ||
			availableEquipment.available_quantity < quantity
		) {
			return interaction.reply({
				content: `Insufficient quantity available. Only ${availableEquipment ? availableEquipment.available_quantity : 0} units of ${equipment.name} are available.`,
				ephemeral: true,
			});
		}

		// Update available quantity
		db.prepare(
			"UPDATE equipment SET available_quantity = available_quantity - ? WHERE id = ?",
		).run(quantity, equipmentId);

		// Insert the request
		db.prepare(`
        INSERT INTO equipment_requests 
        (event_id, equipment_id, quantity, requested_by, status, requested_at, request_id) 
        VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, ?)
      `).run(eventId, equipmentId, quantity, userId, requestId);

		// Verify the request was added
		const addedRequest = db
			.prepare("SELECT * FROM equipment_requests WHERE request_id = ?")
			.get(requestId);
		console.log("Added request:", addedRequest);

		if (!addedRequest) {
			console.error("Failed to find the added request by request_id");
			// Try to find it by other fields as a fallback
			const fallbackRequest = db
				.prepare(
					"SELECT * FROM equipment_requests WHERE event_id = ? AND equipment_id = ? AND requested_by = ? ORDER BY requested_at DESC LIMIT 1",
				)
				.get(eventId, equipmentId, userId);
			console.log("Fallback request lookup:", fallbackRequest);
		}

		// Create approval/denial buttons with shorter custom IDs
		const approveButton = new ButtonBuilder()
			.setCustomId(`app_eq_${requestId}`)
			.setLabel("Approve")
			.setStyle(ButtonStyle.Success);

		const denyButton = new ButtonBuilder()
			.setCustomId(`den_eq_${requestId}`)
			.setLabel("Deny")
			.setStyle(ButtonStyle.Danger);

		const row = new ActionRowBuilder().addComponents(approveButton, denyButton);

		// Create an embed for the equipment request
		const requestEmbed = createEmbed({
			title: "Equipment Request",
			description: `New equipment request for event: **${event.title}**`,
			fields: [
				{
					name: "Equipment",
					value: equipment.name,
					inline: true,
				},
				{
					name: "Quantity",
					value: quantity.toString(),
					inline: true,
				},
				{
					name: "Category",
					value: equipment.category,
					inline: true,
				},
				{
					name: "Requested By",
					value: `<@${userId}>`,
					inline: true,
				},
				{
					name: "Event Date",
					value: `<t:${event.time}:F> (<t:${event.time}:R>)`,
					inline: true,
				},
				{
					name: "Status",
					value: "⏳ Pending Approval",
					inline: true,
				},
				{
					name: "Event ID",
					value: eventId,
					inline: true,
				},
				{
					name: "Request ID",
					value: requestId,
					inline: true,
				},
			],
			color: 0xffa500,
		});

		// First, acknowledge the interaction
		await interaction.reply({
			content: `Successfully requested ${quantity}x ${equipment.name} for event "${event.title}". Awaiting approval. (Request ID: ${requestId})`,
			ephemeral: true,
		});

		// Then, post to the target channel if available
		if (targetChannel?.isTextBased()) {
			await targetChannel.send({
				embeds: [requestEmbed],
				components: [row],
			});
		} else if (EQUIPMENT_REQUEST_CHANNEL_ID) {
			// Try to find the channel by ID if not provided in the command
			const channel = interaction.client.channels.cache.get(
				EQUIPMENT_REQUEST_CHANNEL_ID,
			);
			if (channel?.isTextBased()) {
				await channel.send({
					embeds: [requestEmbed],
					components: [row],
				});
			} else {
				console.error(
					"Equipment request channel not found or not a text channel",
				);
			}
		}
	} catch (error) {
		console.error("Error in handleAddEquipment:", error);
		await interaction.reply({
			content: `Failed to request equipment: ${error.message}`,
			ephemeral: true,
		});
	}
}

async function handleRemoveEquipment(interaction) {
	const eventId = interaction.options.getString("event-id");
	const equipmentId = interaction.options.getString("equipment-id");

	// Verify event exists
	const event = getEvent(eventId);
	if (!event) {
		return interaction.reply({
			content: "Event not found.",
			ephemeral: true,
		});
	}

	// Verify equipment exists
	const equipment = getEquipment(equipmentId);
	if (!equipment) {
		return interaction.reply({
			content: "Equipment not found.",
			ephemeral: true,
		});
	}

	try {
		removeEquipmentRequest(eventId, equipmentId);

		await interaction.reply({
			content: `Successfully removed ${equipment.name} from event "${event.title}"`,
			ephemeral: true,
		});
	} catch (error) {
		await interaction.reply({
			content: `Failed to remove equipment: ${error.message}`,
			ephemeral: true,
		});
	}
}

async function handleListEquipment(interaction) {
	const eventId = interaction.options.getString("event-id");
	const targetChannel =
		interaction.options.getChannel("channel") || interaction.channel;

	const event = getEvent(eventId);
	if (!event) {
		return interaction.reply({
			content: "Event not found.",
			ephemeral: true,
		});
	}

	const equipmentList = getEventEquipment(eventId);

	if (equipmentList.length === 0) {
		return interaction.reply({
			content: `No equipment has been requested for event "${event.title}"`,
			ephemeral: true,
		});
	}

	const groupedEquipment = {};
	// biome-ignore lint/complexity/noForEach: <explanation>
	equipmentList.forEach((item) => {
		if (!groupedEquipment[item.category]) {
			groupedEquipment[item.category] = [];
		}
		groupedEquipment[item.category].push(item);
	});

	const embed = createEmbed({
		title: `Equipment for: ${event.title}`,
		description: "The following equipment has been requested for this event:",
		fields: Object.entries(groupedEquipment).map(([category, items]) => {
			return {
				name: `📋 ${category}`,
				value: items
					.map(
						(item) => `• **${item.name}** (${item.quantity}x) - ${item.status}`,
					)
					.join("\n"),
				inline: false,
			};
		}),
		footer: { text: `Event ID: ${eventId}` },
	});

	// Add event date as a field
	embed.addFields({
		name: "Event Date",
		value: `<t:${event.time}:F> (<t:${event.time}:R>)`,
		inline: false,
	});

	if (targetChannel && targetChannel.id !== interaction.channelId) {
		await targetChannel.send({ embeds: [embed] });
		await interaction.reply({
			content: `Equipment list for "${event.title}" has been posted in <#${targetChannel.id}>`,
			ephemeral: true,
		});
	} else {
		await interaction.reply({
			embeds: [embed],
			ephemeral: false,
		});
	}
}

async function handleApproveEquipment(interaction) {
	const eventId = interaction.options.getString("event-id");
	const equipmentId = interaction.options.getString("equipment-id");

	const event = getEvent(eventId);
	if (!event) {
		return interaction.reply({
			content: "Event not found.",
			ephemeral: true,
		});
	}

	const equipment = getEquipment(equipmentId);
	if (!equipment) {
		return interaction.reply({
			content: "Equipment not found.",
			ephemeral: true,
		});
	}

	try {
		const db = getDatabase();
		const request = db
			.prepare(
				"SELECT * FROM equipment_requests WHERE event_id = ? AND equipment_id = ?",
			)
			.get(eventId, equipmentId);

		if (!request) {
			return interaction.reply({
				content: "Equipment request not found.",
				ephemeral: true,
			});
		}

		if (request.status === "approved") {
			return interaction.reply({
				content: "This equipment request has already been approved.",
				ephemeral: true,
			});
		}

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

		await interaction.reply({
			content: `Successfully approved ${equipment.name} request for event "${event.title}"`,
			ephemeral: true,
		});

		if (EQUIPMENT_REQUEST_CHANNEL_ID) {
			const channel = interaction.client.channels.cache.get(
				EQUIPMENT_REQUEST_CHANNEL_ID,
			);
			if (channel?.isTextBased()) {
				await channel.send({ embeds: [approvalEmbed] });
			}
		}

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
		await interaction.reply({
			content: `Failed to approve equipment request: ${error.message}`,
			ephemeral: true,
		});
	}
}

async function handleDenyEquipment(interaction) {
	const eventId = interaction.options.getString("event-id");
	const equipmentId = interaction.options.getString("equipment-id");
	const reason =
		interaction.options.getString("reason") || "No reason provided";

	const event = getEvent(eventId);
	if (!event) {
		return interaction.reply({
			content: "Event not found.",
			ephemeral: true,
		});
	}

	const equipment = getEquipment(equipmentId);
	if (!equipment) {
		return interaction.reply({
			content: "Equipment not found.",
			ephemeral: true,
		});
	}

	try {
		const db = getDatabase();
		const request = db
			.prepare(
				"SELECT * FROM equipment_requests WHERE event_id = ? AND equipment_id = ?",
			)
			.get(eventId, equipmentId);

		if (!request) {
			return interaction.reply({
				content: "Equipment request not found.",
				ephemeral: true,
			});
		}

		if (request.status === "denied") {
			return interaction.reply({
				content: "This equipment request has already been denied.",
				ephemeral: true,
			});
		}

		updateEquipmentRequestStatus(eventId, equipmentId, "denied");

		db.prepare(
			"UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?",
		).run(request.quantity, equipmentId);

		const denialEmbed = createEmbed({
			title: "Equipment Request Denied",
			description: `Equipment request for event: **${event.title}** has been denied`,
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
					name: "Denied By",
					value: `<@${interaction.user.id}>`,
					inline: true,
				},
				{
					name: "Event Date",
					value: `<t:${event.time}:F> (<t:${event.time}:R>)`,
					inline: true,
				},
				{
					name: "Reason",
					value: reason,
					inline: false,
				},
			],
			color: 0xe74c3c,
		});

		await interaction.reply({
			content: `Denied ${equipment.name} request for event "${event.title}"`,
			ephemeral: true,
		});

		if (EQUIPMENT_REQUEST_CHANNEL_ID) {
			const channel = interaction.client.channels.cache.get(
				EQUIPMENT_REQUEST_CHANNEL_ID,
			);
			if (channel?.isTextBased()) {
				await channel.send({ embeds: [denialEmbed] });
			}
		}

		try {
			const requester = await interaction.client.users.fetch(
				request.requested_by,
			);
			await requester.send({
				content: `Your equipment request for ${equipment.name} has been denied for event "${event.title}"`,
				embeds: [denialEmbed],
			});
		} catch (error) {
			console.error("Could not notify requester:", error);
		}
	} catch (error) {
		await interaction.reply({
			content: `Failed to deny equipment request: ${error.message}`,
			ephemeral: true,
		});
	}
}

async function handlePendingRequests(interaction) {
	const targetChannel =
		interaction.options.getChannel("channel") || interaction.channel;

	const db = getDatabase();

	try {
		const pendingRequests = db
			.prepare(`
          SELECT er.*, e.title as event_title, e.time as event_time, eq.name as equipment_name, eq.category
          FROM equipment_requests er
          JOIN events e ON er.event_id = e.id
          JOIN equipment eq ON er.equipment_id = eq.id
          WHERE er.status = 'pending'
          ORDER BY e.time
        `)
			.all();

		if (pendingRequests.length === 0) {
			return interaction.reply({
				content: "No pending equipment requests found.",
				ephemeral: true,
			});
		}

		const groupedRequests = {};
		// biome-ignore lint/complexity/noForEach: <explanation>
		pendingRequests.forEach((request) => {
			if (!groupedRequests[request.event_id]) {
				groupedRequests[request.event_id] = {
					title: request.event_title,
					time: request.event_time,
					requests: [],
				};
			}
			groupedRequests[request.event_id].requests.push(request);
		});

		const embed = createEmbed({
			title: "Pending Equipment Requests",
			description: "The following equipment requests are awaiting approval:",
			fields: Object.entries(groupedRequests).map(([eventId, eventData]) => {
				return {
					name: `📅 ${eventData.title} - <t:${eventData.time}:F> (<t:${eventData.time}:R>)`,
					value: eventData.requests
						.map(
							(req) =>
								`• **${req.equipment_name}** (${req.quantity}x) - Requested by <@${req.requested_by}> on <t:${Math.floor(new Date(req.requested_at).getTime() / 1000)}:F>`,
						)
						.join("\n"),
					inline: false,
				};
			}),
		});

		if (targetChannel && targetChannel.id !== interaction.channelId) {
			await targetChannel.send({ embeds: [embed] });
			await interaction.reply({
				content: `Pending equipment requests have been posted in <#${targetChannel.id}>`,
				ephemeral: true,
			});
		} else {
			await interaction.reply({
				embeds: [embed],
				ephemeral: false,
			});
		}
	} catch (error) {
		console.error("Error in handlePendingRequests:", error);
		await interaction.reply({
			content: `Failed to retrieve pending requests: ${error.message}`,
			ephemeral: true,
		});
	}
}

// Updated button interaction handler
export async function handleButtonInteraction(interaction) {
	const { customId } = interaction;

	if (customId.startsWith("app_eq_")) {
		const requestId = customId.replace("app_eq_", "");
		console.log(`Looking for equipment request with ID: ${requestId}`);

		try {
			// Get the equipment request using the requestId
			const request = getEquipmentRequestByRequestId(requestId);
			console.log("Found request:", request);

			if (!request) {
				return interaction.reply({
					content: `Equipment request not found with ID: ${requestId}`,
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

			// Get event and equipment details
			const event = getEvent(eventId);
			const equipment = getEquipment(equipmentId);

			// Update the request status
			updateEquipmentRequestStatusByRequestId(requestId, "approved");

			// Create an embed for the approval notification
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
				color: 0x2ecc71, // Green for approval
			});

			// Update the original message
			await interaction.update({
				embeds: [approvalEmbed],
				components: [], // Remove the buttons
			});

			// Try to notify the requester
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
	} else if (customId.startsWith("den_eq_")) {
		// Similar changes for the denial handler...
		const requestId = customId.replace("den_eq_", "");
		console.log(`Preparing denial modal for request ID: ${requestId}`);

		try {
			// Create a modal for denial reason with shorter custom ID
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
}

// Updated modal submission handler
export async function handleModalSubmit(interaction) {
	if (interaction.customId.startsWith("deny_r_")) {
		const requestId = interaction.customId.replace("deny_r_", "");
		const reason = interaction.fields.getTextInputValue("denial_reason");
		console.log(
			`Processing denial for request ID: ${requestId} with reason: ${reason}`,
		);

		try {
			// Get the equipment request using the requestId
			const request = getEquipmentRequestByRequestId(requestId);
			console.log("Found request for denial:", request);

			if (!request) {
				return interaction.reply({
					content: `Equipment request not found with ID: ${requestId}`,
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

			// Get event and equipment details
			const event = getEvent(eventId);
			const equipment = getEquipment(equipmentId);

			// Update the request status
			updateEquipmentRequestStatusByRequestId(requestId, "denied");

			// Return the quantity to available
			const db = getDatabase();
			db.prepare(
				"UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?",
			).run(request.quantity, equipmentId);

			// Create an embed for the denial notification
			const denialEmbed = createEmbed({
				title: "Equipment Request Denied",
				description: `Equipment request for event: **${event.title}** has been denied`,
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
						name: "Denied By",
						value: `<@${interaction.user.id}>`,
						inline: true,
					},
					{
						name: "Reason",
						value: reason,
						inline: false,
					},
				],
				color: 0xe74c3c, // Red for denial
			});

			// Update the original message
			await interaction.update({
				embeds: [denialEmbed],
				components: [], // Remove the buttons
			});

			// Try to notify the requester
			try {
				const requester = await interaction.client.users.fetch(
					request.requested_by,
				);
				await requester.send({
					content: `Your equipment request for ${equipment.name} has been denied for event "${event.title}"`,
					embeds: [denialEmbed],
				});
			} catch (error) {
				console.error("Could not notify requester:", error);
			}
		} catch (error) {
			console.error("Error denying equipment:", error);
			await interaction.reply({
				content: `Error: ${error.message}`,
				ephemeral: true,
			});
		}
	}
}

export async function autocomplete(interaction, client) {
	const focusedOption = interaction.options.getFocused(true);

	let choices = [];

	try {
		const db = getDatabase();

		if (focusedOption.name === "event-id") {
			// Only show future events
			const now = Math.floor(Date.now() / 1000);
			const events = db
				.prepare(
					"SELECT id, title FROM events WHERE time > ? ORDER BY time ASC",
				)
				.all(now);

			choices = events.map((event) => ({
				name: `${event.title} (${event.id})`,
				value: event.id,
			}));
		} else if (focusedOption.name === "equipment-id") {
			const equipment = getAvailableEquipment();

			if (equipment && Array.isArray(equipment)) {
				choices = equipment.map((item) => ({
					name: `${item.name} (${item.available_quantity} available)`,
					value: item.id,
				}));
			} else {
				console.error("getAvailableEquipment did not return an array");
			}
		}

		const filtered = choices.filter((choice) =>
			choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
		);

		await interaction.respond(filtered.slice(0, 25));
	} catch (error) {
		console.error("Error in autocomplete:", error);
		try {
			await interaction.respond([]);
		} catch (e) {
			console.error("Failed to send empty autocomplete response:", e);
		}
	}
}
