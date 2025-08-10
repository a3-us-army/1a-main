import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import client from '../../bot.js';

export const data = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the queue and destroy the player');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 */
export async function execute(interaction) {
    try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (member.user.bot) return;
        if (!member.voice?.channel) return;

        const player = client.moon.players.get(interaction.guildId);
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor(0xFC3A28)
                .setTitle('🎵 1A Music')
                .setDescription('⚠️ No player found in this server.')
                .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png');

            return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
        }

        player.destroy();

        const embed = new EmbedBuilder()
            .setColor(0x2372CB)
            .setTitle('🎵 1A Music')
            .setDescription('🛑 The music queue has been stopped.')
            .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png')
            .setFooter({
                text: `Requested by ${interaction.user.displayName}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            });

        return interaction.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error executing /stop command:', error);
    }
}
