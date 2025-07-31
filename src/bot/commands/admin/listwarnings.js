// commands/listwarnings.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { getWarnings } from '../../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('listwarnings')
  .setDescription('List all warnings for a user')
  .addUserOption(opt =>
    opt.setName('user').setDescription('User to check').setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const guildId = interaction.guild.id;

  const warnings = getWarnings(guildId, user.id);

  if (!warnings.length) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('No Warnings')
          .setDescription(`${user.tag} has no warnings.`),
      ],
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`Warnings for ${user.tag}`)
    .setDescription(
      warnings
        .map(
          (w, i) =>
            `**#${i + 1}** - *${w.reason}*\nWarned by <@${w.moderator_id}> on <t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:f>\nID: \`${w.id}\``
        )
        .join('\n\n')
    )
    .setFooter({ text: `Total: ${warnings.length}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
