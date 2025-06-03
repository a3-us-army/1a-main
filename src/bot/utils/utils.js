// utils.js

import { EmbedBuilder } from "discord.js";

/**
 * Creates a Discord embed with consistent styling
 * @param {Object} options - Options for the embed
 * @param {string} [options.title] - Title of the embed
 * @param {string} [options.description] - Description of the embed
 * @param {string} [options.url] - URL for the embed title
 * @param {string} [options.color] - Color of the embed in hex format
 * @param {Array} [options.fields] - Fields to add to the embed
 * @param {Object} [options.author] - Author information
 * @param {string} [options.author.name] - Name of the author
 * @param {string} [options.author.iconURL] - Icon URL for the author
 * @param {string} [options.author.url] - URL for the author name
 * @param {string} [options.thumbnail] - URL for the thumbnail image
 * @param {string} [options.image] - URL for the main image
 * @param {Object} [options.footer] - Footer information
 * @param {string} [options.footer.text] - Footer text
 * @param {string} [options.footer.iconURL] - Icon URL for the footer
 * @param {Date|number|string} [options.timestamp] - Timestamp for the embed
 * @returns {EmbedBuilder} The created embed
 */
export function createEmbed(options = {}) {
	const embed = new EmbedBuilder();

	// Default color - military green
	const defaultColor = 0x4b5320;

	// Set basic properties
	if (options.title) embed.setTitle(options.title);
	if (options.description) embed.setDescription(options.description);
	if (options.url) embed.setURL(options.url);
	embed.setColor(options.color || defaultColor);

	// Add fields if provided
	if (options.fields && Array.isArray(options.fields)) {
		// biome-ignore lint/complexity/noForEach: <explanation>
		options.fields.forEach((field) => {
			if (field.name && field.value) {
				embed.addFields({
					name: field.name,
					value: field.value,
					inline: field.inline === undefined ? false : field.inline,
				});
			}
		});
	}

	// Set author if provided
	if (options.author?.name) {
		embed.setAuthor({
			name: options.author.name,
			iconURL: options.author.iconURL,
			url: options.author.url,
		});
	}

	// Set images if provided
	if (options.thumbnail) embed.setThumbnail(options.thumbnail);
	if (options.image) embed.setImage(options.image);

	// Set footer if provided
	if (options.footer?.text) {
		embed.setFooter({
			text: options.footer.text,
			iconURL: options.footer.iconURL,
		});
	}

	// Set timestamp if provided, otherwise use current time
	embed.setTimestamp(options.timestamp || new Date());

	return embed;
}

/**
 * Creates a standard error embed
 * @param {string} errorMessage - The error message to display
 * @returns {EmbedBuilder} The error embed
 */
export function createErrorEmbed(errorMessage) {
	return createEmbed({
		title: "Error",
		description: errorMessage,
		color: 0xe74c3c, // Red color for errors
	});
}

/**
 * Creates a standard success embed
 * @param {string} message - The success message to display
 * @returns {EmbedBuilder} The success embed
 */
export function createSuccessEmbed(message) {
	return createEmbed({
		title: "Success",
		description: message,
		color: 0x2ecc71, // Green color for success
	});
}