// commands/admin/create-cert.js
import { SlashCommandBuilder } from "discord.js";
import { addCertification } from "../../utils/database.js";
import { v4 as uuidv4 } from "uuid";

export const data = new SlashCommandBuilder()
	.setName("create-cert")
	.setDescription("Create a new certification (admin only)")
	.addStringOption((opt) =>
		opt.setName("name").setDescription("Certification name").setRequired(true),
	)
	.addStringOption((opt) =>
		opt
			.setName("description")
			.setDescription("Certification description")
			.setRequired(false),
	);

export async function execute(interaction) {
	if (!interaction.member.permissions.has("ADMINISTRATOR")) {
		return interaction.reply({
			content: "You do not have permission.",
			ephemeral: true,
		});
	}
	const name = interaction.options.getString("name");
	const description = interaction.options.getString("description") || "";
	const id = uuidv4();

	try {
		addCertification({ id, name, description });
		await interaction.reply({
			content: `Certification **${name}** created!`,
			ephemeral: true,
		});
	} catch (e) {
		console.error(e);
		await interaction.reply({
			content: "Error creating certification.",
			ephemeral: true,
		});
	}
}