// commands/warn.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { addWarning, getWarnings } from '../../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a user')
  .addUserOption(opt =>
    opt.setName('user').setDescription('User to warn').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('reason').setDescription('Reason').setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const reason =
    interaction.options.getString('reason') || 'No reason provided';
  const guildId = interaction.guild.id;
  const moderatorId = interaction.user.id;

  addWarning(guildId, user.id, moderatorId, reason);

  const warnings = getWarnings(guildId, user.id);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('User Warned')
    .addFields(
      { name: 'User', value: `${user.tag} (<@${user.id}>)`, inline: true },
      { name: 'Reason', value: reason, inline: true },
      { name: 'Total Warnings', value: `${warnings.length}`, inline: true }
    )
    .setFooter({ text: `Warned by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
