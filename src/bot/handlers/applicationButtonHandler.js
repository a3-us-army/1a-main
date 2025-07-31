import {
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from "discord.js";
import {
    getApplication,
    approveApplication,
    denyApplication,
    getDatabase,
} from "../utils/database.js";
import fetchDiscordAvatar from "../../website/utils/fetchDiscordAvatar.js";

const db = getDatabase();

export async function handleApplicationButton(interaction) {
    // Approve: Show modal
    if (
        interaction.isButton() &&
        interaction.customId.startsWith("app_approve_")
    ) {
        const applicationId = interaction.customId.replace("app_approve_", "");
        const app = getApplication(applicationId);
        if (!app) {
            return interaction.reply({
                content: "Application not found.",
                ephemeral: true,
            });
        }

        // Show modal to collect reason for approval
        const modal = new ModalBuilder()
            .setCustomId(`app_approve_modal_${applicationId}`)
            .setTitle("Approve Application");

        const reasonInput = new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Reason for approving (optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reasonInput)
        );

        return interaction.showModal(modal);
    }

    // Modal submit: approve and add to personnel
    if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("app_approve_modal_")
    ) {
        const applicationId = interaction.customId.replace("app_approve_modal_", "");
        const app = getApplication(applicationId);
        if (!app) {
            return interaction.reply({
                content: "Application not found.",
                ephemeral: true,
            });
        }

        const reason = interaction.fields.getTextInputValue("reason").trim();

        approveApplication(applicationId, interaction.user.id);

        // Fetch avatar
        const botToken = process.env.DISCORD_TOKEN;
        const discord_avatar = await fetchDiscordAvatar(app.user_id, botToken);

        // Add to personnel database (minimal info)
        db.prepare(
            `
            INSERT INTO personnel
                (discord_id, discord_username, name, role, status, discord_avatar)
            VALUES (?, ?, ?, ?, ?, ?)
            `
        ).run(
            app.user_id,
            app.username,
            app.unit_name,
            app.mos || null,
            "Active",
            discord_avatar
        );

        const embed = new EmbedBuilder()
            .setTitle("Application Approved")
            .setColor(0x2ecc71)
            .addFields(
                { name: "Applicant", value: `<@${app.user_id}> (${app.username})`, inline: false },
                { name: "How did you find the unit?", value: app.found_unit, inline: false },
                { name: "Whats your steam64 ID?", value: app.steam64 || "N/A", inline: false },
                { name: "What name do you want?", value: app.unit_name || "N/A", inline: false },
                { name: "How old are you?", value: app.age ? app.age.toString() : "N/A", inline: true },
                { name: "List any prior experience?", value: app.experience || "None", inline: false },
                { name: "Whats your desired MOS/AFSC", value: app.mos || "N/A", inline: true },
                { name: "Status", value: "✅ Approved", inline: true },
                { name: "Approved By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Reason", value: reason || "No reason provided.", inline: false }
            )
            .setTimestamp();

        await interaction.update({
            embeds: [embed],
            components: [],
            ephemeral: false
        });

        // DM the user
        try {
            const user = await interaction.client.users.fetch(app.user_id);
            await user.send(
                `Congratulations! Your application to the unit has been **approved**.\n\n**Reason:** ${reason || "No reason provided."}\n\nPlease check Discord for further instructions.`
            );
        } catch (e) {
            console.error("Could not DM applicant:", e);
        }
        return;
    }

    // Deny: Show modal for reason
    if (
        interaction.isButton() &&
        interaction.customId.startsWith("app_deny_")
    ) {
        const applicationId = interaction.customId.replace("app_deny_", "");
        const app = getApplication(applicationId);
        if (!app) {
            return interaction.reply({
                content: "Application not found.",
                ephemeral: true,
            });
        }

        // Show modal to collect reason for denial
        const modal = new ModalBuilder()
            .setCustomId(`app_deny_modal_${applicationId}`)
            .setTitle("Deny Application");

        const reasonInput = new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Reason for denying (required)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reasonInput)
        );

        return interaction.showModal(modal);
    }

    // Modal submit: deny
    if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("app_deny_modal_")
    ) {
        const applicationId = interaction.customId.replace("app_deny_modal_", "");
        const app = getApplication(applicationId);
        if (!app) {
            return interaction.reply({
                content: "Application not found.",
                ephemeral: true,
            });
        }

        const reason = interaction.fields.getTextInputValue("reason").trim();

        denyApplication(applicationId, interaction.user.id, reason);

        const embed = new EmbedBuilder()
            .setTitle("Application Denied")
            .setColor(0xe74c3c)
            .addFields(
                { name: "Applicant", value: `<@${app.user_id}> (${app.username})`, inline: false },
                { name: "How did you find the unit?", value: app.found_unit, inline: false },
                { name: "Whats your steam64 ID?", value: app.steam64, inline: false },
                { name: "What name do you want?", value: app.unit_name, inline: false },
                { name: "How old are you?", value: app.age ? app.age.toString() : "N/A", inline: true },
                { name: "List any prior experience?", value: app.experience || "None", inline: false },
                { name: "Whats your desired MOS/AFSC", value: app.mos || "N/A", inline: true },
                { name: "Status", value: "❌ Denied.", inline: true },
                { name: "Denied By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Reason", value: reason, inline: false }
            )
            .setTimestamp();

        await interaction.update({
            embeds: [embed],
            components: [],
            ephemeral: false
        });

        // DM the user
        try {
            const user = await interaction.client.users.fetch(app.user_id);
            await user.send(
                `We're sorry, but your application to the unit has been **denied**.\n\n**Reason:** ${reason}\n\nPlease contact an admin for more information.`
            );
        } catch (e) {
            console.error("Could not DM applicant:", e);
        }
    }
}