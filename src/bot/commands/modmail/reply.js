import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('reply')
  .setDescription('Reply to the user in this modmail thread')
  .addStringOption(opt =>
    opt.setName('message').setDescription('Message to send').setRequired(true)
  )
  .addBooleanOption(opt =>
    opt
      .setName('anonymous')
      .setDescription('Send anonymously?')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const message = interaction.options.getString('message');
  const anonymous = interaction.options.getBoolean('anonymous') || false;
  const channel = interaction.channel;

  if (!channel.name.startsWith('modmail-')) {
    return await interaction.editReply({
      content: 'This is not a modmail channel.',
    });
  }

  const userId = channel.name.replace('modmail-', '');
  const user = await interaction.client.users.fetch(userId).catch(() => null);
  if (!user) {
    return await interaction.editReply({
      content: 'User not found.',
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('📬 Staff Reply')
    .setDescription(message)
    .setFooter({
      text: anonymous ? 'Staff Team' : `Staff: ${interaction.user.tag}`,
      iconURL: anonymous
        ? interaction.guild.iconURL()
        : interaction.user.displayAvatarURL(),
    })
    .setTimestamp();

  await user.send({ embeds: [embed] }).catch(() => {
    channel.send('❌ Could not DM the user (DMs may be closed).');
  });

  await interaction.editReply({
    content: 'Reply sent.',
  });
}
