import { SlashCommandBuilder } from "discord.js";
import { addEquipment } from "../../utils/database.js";
import { v4 as uuidv4 } from "uuid";

export const data = new SlashCommandBuilder()
	.setName("add-equipment")
	.setDescription("Add new equipment to the inventory")
	.addStringOption((option) =>
		option
			.setName("name")
			.setDescription("Name of the equipment")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("category")
			.setDescription("Category of equipment")
			.setRequired(true)
			.addChoices(
				{ name: "Weapons", value: "Weapons" },
				{ name: "Vehicles", value: "Vehicles" },
				{ name: "Other", value: "Other" },
			),
	)
	.addIntegerOption((option) =>
		option
			.setName("quantity")
			.setDescription("Total quantity available")
			.setRequired(true)
			.setMinValue(1),
	)
	.addStringOption((option) =>
		option
			.setName("description")
			.setDescription("Description of the equipment")
			.setRequired(false),
	);

export async function execute(interaction) {
	// Check if user has admin permissions
	if (!interaction.member.permissions.has("ADMINISTRATOR")) {
		return interaction.reply({
			content: "You don't have permission to add equipment to the inventory.",
			ephemeral: true,
		});
	}

	const name = interaction.options.getString("name");
	const category = interaction.options.getString("category");
	const quantity = interaction.options.getInteger("quantity");
	const description = interaction.options.getString("description") || "";

	try {
		const equipmentId = uuidv4();

		addEquipment({
			id: equipmentId,
			name,
			category,
			total_quantity: quantity,
			description,
			status: "available",
		});

		await interaction.reply({
			content: `Successfully added ${quantity}x ${name} to the ${category} inventory.`,
			ephemeral: true,
		});
	} catch (error) {
		console.error("Error adding equipment:", error);
		await interaction.reply({
			content: `Failed to add equipment: ${error.message}`,
			ephemeral: true,
		});
	}
}
export async function autocomplete(interaction, client) {
	const focusedOption = interaction.options.getFocused(true);
	let choices = [];

	if (focusedOption.name === "event-id") {
		// Get all events from database
		const db = getDatabase();
		const events = db.prepare("SELECT id, title FROM events").all();

		choices = events.map((event) => ({
			name: `${event.title} (${event.id})`,
			value: event.id,
		}));
	} else if (focusedOption.name === "equipment-id") {
		// Get available equipment
		const equipment = getAvailableEquipment();

		choices = equipment.map((item) => ({
			name: `${item.name} (${item.available_quantity} available)`,
			value: item.id,
		}));
	}

	// Filter based on user input
	const filtered = choices.filter((choice) =>
		choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
	);

	// Discord has a limit of 25 choices
	await interaction.respond(filtered.slice(0, 25));
}
