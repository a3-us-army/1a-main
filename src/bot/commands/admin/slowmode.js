import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Set channel slowmode (seconds)')
  .addIntegerOption(opt =>
    opt
      .setName('seconds')
      .setDescription('Slowmode in seconds (0 to disable)')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const seconds = interaction.options.getInteger('seconds');
  if (seconds < 0 || seconds > 21600) {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Slowmode Failed')
      .setDescription('Seconds must be between 0 and 21600.');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  await interaction.channel.setRateLimitPerUser(seconds);
  const embed = new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle('Slowmode Set')
    .setDescription(`🐢 Slowmode set to ${seconds} seconds.`);
  await interaction.reply({ embeds: [embed] });
}
