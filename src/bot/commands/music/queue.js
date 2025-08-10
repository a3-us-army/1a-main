import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import client from '../../bot.js';
import ms from 'ms';

//thanks chatgpt --Fried
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  // Pad seconds with leading zero if needed
  const paddedSeconds = seconds.toString().padStart(2, '0');
  return `${minutes}:${paddedSeconds}`;
}

export const data = new SlashCommandBuilder()
    .setName('queue')
    .setDescription("Show the current queue");

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

        const current = player.current;
        const queue = player.queue.all.slice(0, 9); // preview next 9 tracks

        const embed = new EmbedBuilder()
            .setColor(0x2372CB)
            .setTitle('🔊 Now Playing')
            .setThumbnail(current.artworkUrl || 'https://cdn.xanderxx.xyz/1a-logo.png')
            .setDescription(`[${current.title}](${current.url}) \`[${formatDuration(current.duration)}]\``)
            .setFooter({
                text: `📃 Total tracks: ${player.queue.size + 1}`,
                iconURL: member.displayAvatarURL({ dynamic: true }),
            });

        if (queue.length > 0) {
            embed.addFields([
                {
                    name: '⏭️ Up Next',
                    value: queue
                        .map((track, i) => `**${i + 1}.)** \`${track.title}\``)
                        .join('\n'),
                },
            ]);
        }

        return interaction.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error executing /queue command:', error);
    }
}
