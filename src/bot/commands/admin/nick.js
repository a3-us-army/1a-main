import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nick')
  .setDescription("Change a user's nickname")
  .addUserOption(opt =>
    opt
      .setName('user')
      .setDescription('User to change nickname')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('nickname').setDescription('New nickname').setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames);

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const nickname = interaction.options.getString('nickname');
  const member = await interaction.guild.members
    .fetch(user.id)
    .catch(() => null);

  if (!member) {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Nickname Change Failed')
      .setDescription('User not found.');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  await member.setNickname(nickname);
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('Nickname Changed')
    .addFields(
      { name: 'User', value: `${user.tag} (<@${user.id}>)`, inline: true },
      { name: 'New Nickname', value: `\`${nickname}\``, inline: true }
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}
