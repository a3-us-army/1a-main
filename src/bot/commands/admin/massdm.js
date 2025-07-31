import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("massdm")
    .setDescription("DM multiple users or all users in a role")
    .addStringOption((opt) =>
        opt.setName("message").setDescription("Message to send").setRequired(true)
    )
    .addRoleOption((opt) =>
        opt.setName("role").setDescription("Role to DM").setRequired(false)
    )
    .addStringOption((opt) =>
        opt
            .setName("users")
            .setDescription(
                "User mentions or IDs, separated by spaces or commas"
            )
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Parse users from string option
    const users = [];
    const usersString = interaction.options.getString("users");
    if (usersString) {
        const userIds = usersString.match(/\d{17,19}/g);
        if (userIds) {
            for (const id of userIds) {
                try {
                    const user = await interaction.client.users.fetch(id);
                    if (
                        user &&
                        !user.bot &&
                        !users.find((u) => u.id === user.id)
                    ) {
                        users.push(user);
                    }
                } catch {
                    // Ignore fetch errors
                }
            }
        }
    }

    // Collect users from role option
    const role = interaction.options.getRole("role");
    if (role) {
        const members = await interaction.guild.members.fetch();
        const roleMembers = members.filter((m) =>
            m.roles.cache.has(role.id)
        );
        for (const member of roleMembers.values()) {
            if (
                !users.find((u) => u.id === member.user.id) &&
                !member.user.bot
            ) {
                users.push(member.user);
            }
        }
    }

    const message = interaction.options.getString("message");

    if (users.length === 0) {
        return await interaction.editReply({
            content:
                "⚠️ You must specify at least one user (via mentions/IDs) or a role.",
        });
    }

    let success = 0;
    let failed = 0;
    const failedUsers = [];
    const senderTag = interaction.user.tag;
    const senderMention = `<@${interaction.user.id}>`;
    const guildName = interaction.guild.name;
    const guildIcon = interaction.guild.iconURL() || undefined;

    // Prepare the DM embed
    const dmEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📬 You have a new message!")
        .setDescription(message)
        .addFields(
            { name: "From", value: `${senderTag} (${senderMention})`, inline: false },
            { name: "Server", value: guildName, inline: false }
        )
        .setFooter({
            text: `Sent via Mass DM Utility`,
            iconURL: guildIcon,
        })
        .setTimestamp();

    for (const user of users) {
        try {
            await user.send({ embeds: [dmEmbed] });
            success++;
        } catch {
            failed++;
            failedUsers.push(user.tag ? `${user.tag} (<@${user.id}>)` : `<@${user.id}>`);
        }
    }

    // Limit failed users shown to 10 for readability
    let failedUsersDisplay = "None!";
    if (failedUsers.length > 0) {
        const shown = failedUsers.slice(0, 10);
        failedUsersDisplay = shown.join("\n");
        if (failedUsers.length > 10) {
            failedUsersDisplay += `\n...and ${failedUsers.length - 10} more.`;
        }
    }

    const reportEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📬 Mass DM Report")
        .setDescription(
            `Your message has been sent to the selected users.\n\n` +
            `**Message Preview:**\n> ${message.length > 100 ? message.slice(0, 100) + "..." : message}`
        )
        .addFields(
            { name: "Total Attempted", value: `${users.length}`, inline: true },
            { name: "Success", value: `${success}`, inline: true },
            { name: "Failed", value: `${failed}`, inline: true },
            {
                name: "Sent By",
                value: `${senderTag} (${senderMention})`,
                inline: false,
            },
            {
                name: "Failed Users",
                value: failedUsersDisplay,
                inline: false,
            }
        )
        .setFooter({
            text: `Mass DM Utility • ${guildName}`,
            iconURL: guildIcon,
        })
        .setTimestamp();

    await interaction.editReply({
        embeds: [reportEmbed],
    });
}