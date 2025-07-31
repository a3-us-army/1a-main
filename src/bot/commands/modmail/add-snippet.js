import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createSnippet } from '../../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('add-snippet')
  .setDescription('Add a new canned response')
  .addStringOption(opt =>
    opt.setName('name').setDescription('Snippet name').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('content').setDescription('Snippet content').setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.options.getString('name');
  const content = interaction.options.getString('content');
  const created_by = interaction.user.id;

  try {
    createSnippet({ name, content, created_by });
    await interaction.editReply({
      content: `Snippet \`${name}\` added!`,
    });
  } catch (e) {
    await interaction.editReply({
      content: 'Failed to add snippet (maybe name already exists).',
    });
  }
}
