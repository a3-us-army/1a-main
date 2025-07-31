import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from "discord.js";
import { blockUser } from "../../utils/modmail.js";

export const data = new SlashCommandBuilder()
    .setName("block")
    .setDescription("Block a user from using modmail")
    .addUserOption((opt) =>
        opt.setName("user").setDescription("User to block").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user");
    await blockUser(user.id);
    await interaction.editReply({
        content: `${user.tag} has been blocked from modmail.`,
    });
}