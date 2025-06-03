import { SlashCommandBuilder } from "discord.js";
import { removeEquipment, getAllEquipment } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("remove-equipment")
	.setDescription("Remove equipment from the inventory")
	.addStringOption((option) =>
		option
			.setName("equipment-id")
			.setDescription("The ID of the equipment to remove")
			.setRequired(true)
			.setAutocomplete(true),
	);

export async function execute(interaction) {
	// Check if user has admin permissions
	if (!interaction.member.permissions.has("ADMINISTRATOR")) {
		return interaction.reply({
			content:
				"You don't have permission to remove equipment from the inventory.",
			ephemeral: true,
		});
	}

	const equipmentId = interaction.options.getString("equipment-id");

	try {
		const equipmentList = getAllEquipment();
		const equipment = equipmentList.find((e) => e.id === equipmentId);

		if (!equipment) {
			return await interaction.reply({
				content: "Equipment not found.",
				ephemeral: true,
			});
		}

		removeEquipment(equipmentId);

		await interaction.reply({
			content: `Successfully removed **${equipment.name}** from the inventory.`,
			ephemeral: true,
		});
	} catch (error) {
		console.error("Error removing equipment:", error);
		await interaction.reply({
			content: `Failed to remove equipment: ${error.message}`,
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