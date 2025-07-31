import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { tagThread } from '../../utils/modmail.js';

export const data = new SlashCommandBuilder()
  .setName('tag')
  .setDescription('Tag this modmail thread')
  .addStringOption(opt =>
    opt.setName('tag').setDescription('Tag to add').setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const tag = interaction.options.getString('tag');
  const channel = interaction.channel;

  if (!channel.name.startsWith('modmail-')) {
    return await interaction.editReply({
      content: 'This is not a modmail channel.',
    });
  }

  await tagThread(channel, tag);
  await interaction.editReply({
    content: `Thread tagged as **${tag}**.`,
  });
}
