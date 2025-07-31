import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('socials')
  .setDescription('The US Army social media accounts.')
  .setContexts(0, 1, 2)
  .setDMPermission(true)
  .setIntegrationTypes(0, 1);

export async function execute(interaction) {
  await interaction.reply('N/A');
}
