import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("note")
    .setDescription("Add an internal note to this modmail thread")
    .addStringOption((opt) =>
        opt.setName("note").setDescription("Note content").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const note = interaction.options.getString("note");
    const channel = interaction.channel;

    if (!channel.name.startsWith("modmail-")) {
        return await interaction.editReply({
            content: "This is not a modmail channel.",
        });
    }

    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0xffc107)
                .setTitle("📝 Internal Note")
                .setDescription(note)
                .setFooter({ text: `By ${interaction.user.tag}` })
                .setTimestamp(),
        ],
    });

    await interaction.editReply({
        content: "Note added.",
    });
}