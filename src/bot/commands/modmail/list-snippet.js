import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { getAllSnippets } from '../../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('list-snippets')
  .setDescription('List all canned responses')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const snippets = getAllSnippets();
  if (!snippets.length) {
    return await interaction.editReply({
      content: 'No snippets found.',
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('📋 Snippets')
    .setColor(0x5865f2)
    .setDescription(
      snippets
        .map(
          s =>
            `\`${s.name}\`: ${s.content.slice(0, 50)}${
              s.content.length > 50 ? '...' : ''
            }`
        )
        .join('\n')
    );

  await interaction.editReply({ embeds: [embed] });
}
