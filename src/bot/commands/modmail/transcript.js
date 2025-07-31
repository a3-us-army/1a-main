import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from "discord.js";
import {
    saveTranscript,
    uploadTranscriptToR2,
} from "../../utils/modmail.js";

export const data = new SlashCommandBuilder()
    .setName("transcript")
    .setDescription("Export and upload a transcript of this modmail thread")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;

    if (!channel.name.startsWith("modmail-")) {
        return await interaction.editReply({
            content: "This is not a modmail channel.",
        });
    }

    const transcriptPath = await saveTranscript(channel);
    const fileName = `transcript-${channel.id}-${Date.now()}.txt`;
    let r2Url = null;
    try {
        r2Url = await uploadTranscriptToR2(transcriptPath, fileName);
    } catch {
        r2Url = null;
    }

    await interaction.editReply({
        content: r2Url
            ? `Transcript uploaded: ${r2Url}`
            : "Transcript upload failed.",
    });
}