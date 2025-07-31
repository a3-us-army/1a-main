// commands/admin/delete-cert.js
import { SlashCommandBuilder } from "discord.js";
import {
	getAllCertifications,
	getCertification,
	deleteCertification,
} from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("delete-cert")
	.setDescription("Delete a certification (admin only)")
	.addStringOption((opt) =>
		opt
			.setName("certification")
			.setDescription("Certification to delete")
			.setRequired(true)
			.setAutocomplete(true),
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
	deleteCertification(certId);
	await interaction.reply({
		content: `Certification **${cert.name}** deleted.`,
		ephemeral: true,
	});
}