import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
	getAllEquipment,
	getEquipment,
	editEquipment,
} from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("edit-equipment")
	.setDescription("Edit equipment in the inventory")
	.addStringOption((option) =>
		option
			.setName("equipment-id")
			.setDescription("The ID of the equipment to edit")
			.setRequired(true)
			.setAutocomplete(true),
	)
	.addStringOption((option) =>
		option.setName("name").setDescription("New name").setRequired(false),
	)
	.addStringOption((option) =>
		option
			.setName("category")
			.setDescription("New category")
			.setRequired(false)
			.addChoices(
				{ name: "Weapons", value: "Weapons" },
				{ name: "Vehicles", value: "Vehicles" },
				{ name: "Communications", value: "Communications" },
				{ name: "Medical", value: "Medical" },
				{ name: "Tactical", value: "Tactical" },
				{ name: "Other", value: "Other" },
			),
	)
	.addIntegerOption((option) =>
		option
			.setName("quantity")
			.setDescription("New total quantity")
			.setRequired(false)
			.setMinValue(1),
	)
	.addStringOption((option) =>
		option
			.setName("description")
			.setDescription("New description")
			.setRequired(false),
	);

export async function execute(interaction) {
	if (!interaction.member.permissions.has("ADMINISTRATOR")) {
		return interaction.reply({
			content: "You don't have permission to edit equipment in the inventory.",
			ephemeral: true,
		});
	}

	const equipmentId = interaction.options.getString("equipment-id");
	const name = interaction.options.getString("name");
	const category = interaction.options.getString("category");
	const quantity = interaction.options.getInteger("quantity");
	const description = interaction.options.getString("description");

	if (!name && !category && !quantity && !description) {
		return interaction.reply({
			content: "You must specify at least one field to update.",
			ephemeral: true,
		});
	}

	const oldEquipment = getEquipment(equipmentId);
	if (!oldEquipment) {
		return interaction.reply({
			content: "Equipment not found.",
			ephemeral: true,
		});
	}

	try {
		editEquipment(equipmentId, { name, category, quantity, description });
		const newEquipment = getEquipment(equipmentId);

		const embed = new EmbedBuilder()
			.setTitle("Equipment Edited")
			.setColor(0x3498db)
			.addFields(
				{
					name: "Name",
					value: `**Before:** ${oldEquipment.name}\n**After:** ${newEquipment.name}`,
					inline: false,
				},
				{
					name: "Category",
					value: `**Before:** ${oldEquipment.category}\n**After:** ${newEquipment.category}`,
					inline: false,
				},
				{
					name: "Total Quantity",
					value: `**Before:** ${oldEquipment.total_quantity}\n**After:** ${newEquipment.total_quantity}`,
					inline: false,
				},
				{
					name: "Description",
					value: `**Before:** ${oldEquipment.description || "None"}\n**After:** ${newEquipment.description || "None"}`,
					inline: false,
				},
			)
			.setFooter({ text: `Equipment ID: ${equipmentId}` });

		await interaction.reply({
			content: "Successfully updated equipment.",
			embeds: [embed],
			ephemeral: true,
		});
	} catch (error) {
		console.error("Error editing equipment:", error);
		await interaction.reply({
			content: `Failed to edit equipment: ${error.message}`,
			ephemeral: true,
		});
	}
}

export async function autocomplete(interaction) {
	const focusedValue = interaction.options.getFocused();
	const equipmentList = getAllEquipment();

	const choices = equipmentList.map((item) => ({
		name: `${item.name} (${item.category})`,
		value: item.id,
	}));

	const filtered = choices.filter((choice) =>
		choice.name.toLowerCase().includes(focusedValue.toLowerCase()),
	);

	await interaction.respond(filtered.slice(0, 25));
}
