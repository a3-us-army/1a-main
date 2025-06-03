import { SlashCommandBuilder } from "discord.js";
import { getAllEquipment } from "../../utils/database.js";
import { createEmbed } from "../../utils/utils.js";

export const data = new SlashCommandBuilder()
	.setName("inventory")
	.setDescription("List all available equipment")
	.addChannelOption((option) =>
		option
			.setName("channel")
			.setDescription(
				"Channel to post the inventory (defaults to current channel)",
			)
			.addChannelTypes(0) // 0 = GUILD_TEXT
			.setRequired(false),
	);

export async function execute(interaction) {
	const targetChannel =
		interaction.options.getChannel("channel") || interaction.channel;
	const equipment = getAllEquipment();

	if (equipment.length === 0) {
		return interaction.reply({
			content: "No equipment found in inventory.",
			ephemeral: true,
		});
	}

	// Group equipment by category
	const groupedEquipment = {};
	// biome-ignore lint/complexity/noForEach: <explanation>
	equipment.forEach((item) => {
		if (!groupedEquipment[item.category]) {
			groupedEquipment[item.category] = [];
		}
		groupedEquipment[item.category].push(item);
	});

	// Create embed
	const embed = createEmbed({
		title: "Equipment Inventory",
		description: "Available equipment in inventory:",
		fields: Object.entries(groupedEquipment).map(([category, items]) => {
			return {
				name: `📋 ${category}`,
				value: items
					.map(
						(item) =>
							`• **${item.name}** - ${item.available_quantity}/${item.total_quantity} available`,
					)
					.join("\n"),
				inline: false,
			};
		}),
	});

	// Send to the target channel
	if (targetChannel && targetChannel.id !== interaction.channelId) {
		await targetChannel.send({ embeds: [embed] });
		await interaction.reply({
			content: `Equipment inventory has been posted in <#${targetChannel.id}>`,
			ephemeral: true,
		});
	} else {
		await interaction.reply({
			embeds: [embed],
			ephemeral: false,
		});
	}
}
