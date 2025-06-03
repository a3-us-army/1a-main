import { EmbedBuilder } from "discord.js";
import {
	getApplication,
	approveApplication,
	denyApplication,
} from "../utils/database.js"; // adjust path as needed

export async function handleApplicationButton(interaction) {
	// Approve
	if (interaction.customId.startsWith("app_approve_")) {
		const applicationId = interaction.customId.replace("app_approve_", "");
		const app = getApplication(applicationId);
		if (!app) {
			return interaction.reply({
				content: "Application not found.",
				ephemeral: true,
			});
		}

		approveApplication(applicationId, interaction.user.id);

		const embed = new EmbedBuilder()
			.setTitle("Application Approved")
			.setColor(0x2ecc71)
			.addFields(
				{
					name: "Applicant",
					value: `<@${app.user_id}> (${app.username})`,
					inline: false,
				},
				{
					name: "How did you find the unit?",
					value: app.found_unit,
					inline: false,
				},
				{ name: "Whats your steam64 ID?", value: app.steam64, inline: false },
				{ name: "What name do you want?", value: app.unit_name, inline: false },
				{
					name: "How old are you?",
					value: app.age ? app.age.toString() : "N/A",
					inline: true,
				},
				{
					name: "List any prior experience?",
					value: app.experience || "None",
					inline: false,
				},
				{
					name: "Whats your desired MOS/AFSC",
					value: app.mos || "N/A",
					inline: true,
				},
				{ name: "Status", value: "✅ Approved", inline: true },
				{
					name: "Approved By",
					value: `<@${interaction.user.id}>`,
					inline: true,
				},
			)
			.setTimestamp();

		await interaction.update({ embeds: [embed], components: [] });

		// DM the user
		try {
			const user = await interaction.client.users.fetch(app.user_id);
			await user.send(
				"Congratulations! Your application to the unit has been **approved**. Please check Discord for further instructions.",
			);
		} catch (e) {
			console.error("Could not DM applicant:", e);
		}
	}

	// Deny
	if (interaction.customId.startsWith("app_deny_")) {
		const applicationId = interaction.customId.replace("app_deny_", "");
		const app = getApplication(applicationId);
		if (!app) {
			return interaction.reply({
				content: "Application not found.",
				ephemeral: true,
			});
		}

		denyApplication(applicationId, interaction.user.id, "Denied by admin");

		const embed = new EmbedBuilder()
			.setTitle("Application Approved")
			.setColor(0x2ecc71)
			.addFields(
				{
					name: "Applicant",
					value: `<@${app.user_id}> (${app.username})`,
					inline: false,
				},
				{
					name: "How did you find the unit?",
					value: app.found_unit,
					inline: false,
				},
				{ name: "Whats your steam64 ID?", value: app.steam64, inline: false },
				{ name: "What name do you want?", value: app.unit_name, inline: false },
				{
					name: "How old are you?",
					value: app.age ? app.age.toString() : "N/A",
					inline: true,
				},
				{
					name: "List any prior experience?",
					value: app.experience || "None",
					inline: false,
				},
				{
					name: "Whats your desired MOS/AFSC",
					value: app.mos || "N/A",
					inline: true,
				},
				{ name: "Status", value: "❌ Denied.", inline: true },
				{
					name: "Denied By",
					value: `<@${interaction.user.id}>`,
					inline: true,
				},
			)
			.setTimestamp();

		await interaction.update({ embeds: [embed], components: [] });

		// DM the user
		try {
			const user = await interaction.client.users.fetch(app.user_id);
			await user.send(
				"We're sorry, but your application to the unit has been **denied**. Please contact an admin for more information.",
			);
		} catch (e) {
			console.error("Could not DM applicant:", e);
		}
	}
}
