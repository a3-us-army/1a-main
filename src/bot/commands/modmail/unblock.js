import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from "discord.js";
import { unblockUser } from "../../utils/modmail.js";

export const data = new SlashCommandBuilder()
    .setName("unblock")
    .setDescription("Unblock a user from using modmail")
    .addUserOption((opt) =>
        opt.setName("user").setDescription("User to unblock").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user");
    await unblockUser(user.id);
    await interaction.editReply({
        content: `${user.tag} has been unblocked from modmail.`,
    });
}