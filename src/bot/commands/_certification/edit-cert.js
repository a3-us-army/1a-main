// commands/admin/edit-cert.js
import { SlashCommandBuilder } from "discord.js";
import {
	getAllCertifications,
	getCertification,
	editCertification,
} from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("edit-cert")
	.setDescription("Edit a certification (admin only)")
	.addStringOption((opt) =>
		opt
			.setName("certification")
			.setDescription("Certification to edit")
			.setRequired(true)
			.setAutocomplete(true),
	)
	.addStringOption((opt) =>
		opt.setName("name").setDescription("New name").setRequired(false),
	)
	.addStringOption((opt) =>
		opt
			.setName("description")
			.setDescription("New description")
			.setRequired(false),
	);

export async function autocomplete(interaction) {
	const focused = interaction.options.getFocused().toLowerCase();
	const certs = getAllCertifications();
	const choices = certs
		.filter((cert) => cert.name.toLowerCase().includes(focused))
		.map((cert) => ({ name: cert.name, value: cert.id }));
	await interaction.respond(choices.slice(0, 25));
}

export async function execute(interaction) {
	if (!interaction.member.permissions.has("ADMINISTRATOR")) {
		return interaction.reply({
			content: "You do not have permission.",
			ephemeral: true,
		});
	}
	const certId = interaction.options.getString("certification");
	const cert = getCertification(certId);
	if (!cert) {
		return interaction.reply({
			content: "Certification not found.",
			ephemeral: true,
		});
	}
	const newName = interaction.options.getString("name");
	const newDesc = interaction.options.getString("description");
	if (!newName && !newDesc) {
		return interaction.reply({
			content: "Nothing to update.",
			ephemeral: true,
		});
	}
	editCertification(certId, newName, newDesc);
	await interaction.reply({
		content: `Certification **${cert.name}** updated.`,
		ephemeral: true,
	});
}