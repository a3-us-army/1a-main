import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import client from '../../bot.js';

export const data = new SlashCommandBuilder()
    .setName('pause')
    .setDescription("Pause the Queue");

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
                .setTitle('🎶 1A Music')
                .setDescription('⚠️ **No active player was found in this server.**')
                .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png')
                .setFooter({
                    text: `Requested by ${interaction.user.displayName}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
        }

        if (player.paused) {
            const embed = new EmbedBuilder()
                .setColor(0xFC3A28)
                .setTitle('🎶 1A Music')
                .setDescription('⏸️ **The player is already paused.**\n\nUse `/resume` to continue playback.')
                .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png')
                .setFooter({
                    text: `Requested by ${interaction.user.displayName}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
        }

        player.pause();

        const embed = new EmbedBuilder()
            .setColor(0x2372CB)
            .setTitle('🎶 1A Music')
            .setDescription('⏸️ **The player has been paused.**\n\nUse `/resume` to continue playback.')
            .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png')
            .setFooter({
                text: `Requested by ${interaction.user.displayName}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            })
            .setTimestamp();

        interaction.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error executing pause command:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor(0xFC3A28)
            .setTitle('❌ An error occurred')
            .setDescription('Something went wrong while executing this command. Please try again later.')
            .setFooter({
                text: `Requested by ${interaction.user.displayName}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            })
            .setTimestamp();

        interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}
