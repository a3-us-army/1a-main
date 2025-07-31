import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription(
    'Unlock the current channel (allow @everyone to send messages)'
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const channel = interaction.channel;
  const everyoneRole = interaction.guild.roles.everyone;
  const perms = channel.permissionOverwrites.cache.get(everyoneRole.id);

  if (!perms || !perms.deny.has(PermissionFlagsBits.SendMessages)) {
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Channel Not Locked')
      .setDescription('This channel is not locked.');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  try {
    await channel.permissionOverwrites.edit(everyoneRole, {
      SendMessages: null,
    });
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🔓 Channel Unlocked')
      .setDescription('Members can send messages again.');
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Unlock Failed')
      .setDescription('Failed to unlock the channel.');
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
