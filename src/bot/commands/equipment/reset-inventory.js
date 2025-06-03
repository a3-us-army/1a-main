import { SlashCommandBuilder } from "discord.js";
import { resetEntireInventory } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("reset-inventory")
	.setDescription(
		"Reset the entire equipment inventory (all equipment fully available)",
	);

export async function execute(interaction) {
	if (!interaction.member.permissions.has("ADMINISTRATOR")) {
		return interaction.reply({
			content: "You don't have permission to reset the inventory.",
			ephemeral: true,
		});
	}

	try {
		resetEntireInventory();
		await interaction.reply({
			content:
				"The entire equipment inventory has been reset. All equipment is now fully available.",
			ephemeral: true,
		});
	} catch (error) {
		console.error("Error resetting inventory:", error);
		await interaction.reply({
			content: "There was an error resetting the inventory.",
			ephemeral: true,
		});
	}
}
