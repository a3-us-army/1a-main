import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Bulk delete messages')
  .addIntegerOption(opt =>
    opt
      .setName('amount')
      .setDescription('Number of messages (max 100)')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const amount = interaction.options.getInteger('amount');
  if (amount < 1 || amount > 100) {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Clear Failed')
      .setDescription('Amount must be between 1 and 100.');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  await interaction.channel.bulkDelete(amount, true);
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Messages Deleted')
    .setDescription(`🧹 Deleted ${amount} messages.`);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
