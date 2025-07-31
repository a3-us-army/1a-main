import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import {
  removeWarning,
  getWarning,
  getWarnings,
} from '../../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('unwarn')
  .setDescription('Remove a warning from a user (by warning ID)')
  .addUserOption(opt =>
    opt.setName('user').setDescription('User to unwarn').setRequired(true)
  )
  .addStringOption(opt =>
    opt
      .setName('id')
      .setDescription('Warning ID to remove (autocomplete)')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const warningId = interaction.options.getString('id');
  const warning = getWarning(warningId);

  if (!warning) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('Unwarn Failed')
          .setDescription('Warning not found.'),
      ],
      ephemeral: true,
    });
  }

  removeWarning(warningId);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Warning Removed')
    .addFields(
      { name: 'User', value: `<@${warning.user_id}>`, inline: true },
      { name: 'Reason', value: warning.reason, inline: true }
    )
    .setFooter({ text: `Removed by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export async function autocomplete(interaction) {
  const userOption = interaction.options.get('user');
  if (!userOption || !userOption.value) {
    return interaction.respond([]);
  }

  let userId = userOption.value;
  if (typeof userId === 'object' && userId.id) userId = userId.id;

  const guildId = interaction.guild.id;
  const warnings = getWarnings(guildId, userId);

  const focused = interaction.options.getFocused().toLowerCase();

  const choices = warnings
    .filter(
      w => w.id.startsWith(focused) || w.reason?.toLowerCase().includes(focused)
    )
    .slice(0, 25)
    .map(w => ({
      name: `${w.reason} (${w.id.slice(0, 8)})`,
      value: w.id,
    }));

  await interaction.respond(choices);
}
