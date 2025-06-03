import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { v4 as uuidv4 } from "uuid";
import { createEvent } from "../../utils/database.js";

// Command definition
export const data = new SlashCommandBuilder()
	.setName("create-event")
	.setDescription("Create a new event.");

// Command execution
export async function execute(interaction) {
	const modal = new ModalBuilder()
		.setCustomId("create_event_modal")
		.setTitle("Create an Event");

	const titleInput = new TextInputBuilder()
		.setCustomId("event_title")
		.setLabel("Event Name")
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	const descriptionInput = new TextInputBuilder()
		.setCustomId("event_description")
		.setLabel("Description")
		.setStyle(TextInputStyle.Paragraph)
		.setRequired(false);

	const timeInput = new TextInputBuilder()
		.setCustomId("event_time")
		.setLabel("Time (UNIX TIMESTAMP ONLY)")
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	const locationInput = new TextInputBuilder()
		.setCustomId("event_location")
		.setLabel("Location")
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	const imageInput = new TextInputBuilder()
		.setCustomId("event_image")
		.setLabel("Image URL (optional)")
		.setStyle(TextInputStyle.Short)
		.setRequired(false);

	modal.addComponents(
		new ActionRowBuilder().addComponents(titleInput),
		new ActionRowBuilder().addComponents(descriptionInput),
		new ActionRowBuilder().addComponents(timeInput),
		new ActionRowBuilder().addComponents(locationInput),
		new ActionRowBuilder().addComponents(imageInput),
	);

	await interaction.showModal(modal);
}

// Handle modal submission
export async function handleModalSubmit(interaction) {
	const title = interaction.fields.getTextInputValue("event_title");
	const description =
		interaction.fields.getTextInputValue("event_description") ||
		"No description provided";
	const time = interaction.fields.getTextInputValue("event_time");
	const location = interaction.fields.getTextInputValue("event_location");
	const image = interaction.fields.getTextInputValue("event_image") || null;
	const eventId = uuidv4();

	const fullDescription = `${description}\n\n**Event Time**: <t:${time}:F> (<t:${time}:R>)\n\n**Location**: ${location}`;

	const embed = new EmbedBuilder()
		.setTitle(`${title}`)
		.setDescription(fullDescription)
		.addFields(
			{
				name: "<:checkmark:1365157872685547540> Attending (0)",
				value: "N/A",
				inline: true,
			},
			{
				name: "<:x_:1365157886908567592> Not Attending (0)",
				value: "N/A",
				inline: true,
			},
			{
				name: "<:question:1365157901450346536> Maybe (0)",
				value: "N/A",
				inline: true,
			},
		)
		.setColor(0x5865f2)
		.setTimestamp()
		.setFooter({ text: `Event ID: ${eventId}` });

	if (image) {
		embed.setThumbnail(image);
	} else {
		embed.setThumbnail("https://cdn.xanderxx.xyz/1a-logo.png");
	}

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`rsvp_${eventId}_yes`)
			.setEmoji("<:checkmark:1365157872685547540>")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`rsvp_${eventId}_no`)
			.setEmoji("<:x_:1365157886908567592>")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`rsvp_${eventId}_maybe`)
			.setEmoji("<:question:1365157901450346536>")
			.setStyle(ButtonStyle.Secondary),
	);

	const message = await interaction.reply({
		content: "<@&1363609382700712129>",
		embeds: [embed],
		components: [row],
		fetchReply: true,
		allowedMentions: { parse: ["users", "roles"], repliedUser: true },
	});

	// Save event to database
	createEvent({
		id: eventId,
		creator_id: interaction.user.id,
		title,
		description,
		time,
		location, // changed from duration
		image,
		message_id: message.id,
		channel_id: message.channelId,
	});
}
