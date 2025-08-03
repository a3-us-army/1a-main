import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('event-times')
  .setDescription('Our op times.')
  .setContexts(0, 1, 2)
  .setDMPermission(true)
  .setIntegrationTypes(0, 1);

export async function execute(interaction) {
  await interaction.reply(
    '**Saturday:** 8 PM EST | <t:1747699200:t>\n\n**Sunday:** 8 PM EST | <t:1747699200:t>'
  );
}
