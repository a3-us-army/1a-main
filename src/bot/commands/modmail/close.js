import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from "discord.js";
import {
    saveTranscript,
    uploadTranscriptToR2,
    extractUserIdFromTopic
} from "../../utils/modmail.js";
import { LOG_CHANNEL_ID } from "../../config/modmail.js";

export const data = new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close this modmail thread and log it")
    .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for closing").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.options.getString("reason") || "No reason provided";
    const channel = interaction.channel;

    if (!channel.name.startsWith("modmail-")) {
        return await interaction.editReply({
            content: "This is not a modmail channel.",
        });
    }

    const topic = channel.topic || "";
    const userId = extractUserIdFromTopic(topic);
    const transcriptPath = await saveTranscript(channel);
    let r2Url = null;
    try {
        const fileName = `transcript-${channel.id}-${Date.now()}.txt`;
        r2Url = await uploadTranscriptToR2(transcriptPath, fileName);
    } catch (e) {
        console.error("R2 upload failed:", e);
        r2Url = null;
    }

    // Log to log channel
    const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
    let threadUserTag = "Unknown User";
    let threadUserMention = userId ? `<@${userId}>` : "Unknown";
    try {
        const threadUser = await client.users.fetch(userId);
        threadUserTag = `${threadUser.tag} (${threadUserMention})`;
    } catch {
        threadUserTag = `Unknown User (${userId})`;
    }

    await logChannel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("Modmail Closed")
                .setDescription(
                    `Closed by ${interaction.user.tag} (<@${interaction.user.id}>)

**Thread for:** ${threadUserTag}

[Transcript](${r2Url || "Upload failed"})`
                )
                .setTimestamp(),
        ],
    });

    // Notify user
    if (userId) {
        try {
            const dmUser = await client.users.fetch(userId);
            await dmUser.send({
                content: "Your modmail thread has been closed. If you need further assistance, feel free to DM me again!",
            });
        } catch (e) {
            console.error("Failed to send close DM:", e);
        }
    }

    await interaction.editReply({ content: "Thread closed and transcript uploaded.", ephemeral: true });
    setTimeout(() => channel.delete(), 5000);
}