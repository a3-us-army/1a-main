import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('lockdown')
  .setDescription(
    'Lock the current channel (prevent @everyone from sending messages)'
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const channel = interaction.channel;
  const everyoneRole = interaction.guild.roles.everyone;
  const perms = channel.permissionOverwrites.cache.get(everyoneRole.id);

  if (perms?.deny.has(PermissionFlagsBits.SendMessages)) {
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('Channel Already Locked')
      .setDescription('This channel is already locked.');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  try {
    await channel.permissionOverwrites.edit(everyoneRole, {
      SendMessages: false,
    });
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🔒 Channel Locked')
      .setDescription('Members can no longer send messages in this channel.');
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Lockdown Failed')
      .setDescription('Failed to lock the channel.');
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
