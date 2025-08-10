import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionsBitField } from 'discord.js';
import client from '../bot.js';

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function musicHandler() {
    client.moon.on('trackStart', async (player, track) => {
        // Safe requester info fallback
        const requesterTag = track.requestedBy?.displayName ?? 'Unknown';
        const requesterAvatar = track.requestedBy?.displayAvatarURL
          ? track.requestedBy.displayAvatarURL({ dynamic: true })
          : null;

        const embed = new EmbedBuilder()
            .setColor(0x2372CB)
            .setTitle('🎶 1A Music')
            .setDescription(`▶️ Now playing: [${track.title}](${track.url}) [${formatDuration(track.duration)}]`)
            .setThumbnail(track.artworkUrl || 'https://cdn.xanderxx.xyz/1a-logo.png')
            .setFooter({
              text: `Requested by ${requesterTag}`,
              ...(requesterAvatar && { iconURL: requesterAvatar }),
            })
            .setTimestamp();

        try {
            client.channels.cache.get(player.textChannelId).send({ embeds: [embed] });
        } catch (error) {
            console.error(error);
        }
    })

    client.moon.on('playerDisconnected', async (player) => {
        player.destroy();
        const embed = new EmbedBuilder()
            .setColor(0xFC3A28)
            .setTitle('📴 1A Music')
            .setDescription('The player has been **disconnected** from the voice channel.')
            .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png')
            .setTimestamp();

        try {
            client.channels.cache.get(player.textChannelId).send({ embeds: [embed] });
        } catch (error) {
            console.error(error);
        }
    })

    client.moon.on('queueEnd', async (player) => {
        player.destroy();
        const embed = new EmbedBuilder()
            .setColor(0xFC3A28)
            .setTitle('📴 1A Music')
            .setDescription('The queue has **ended**.')
            .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png')
            .setTimestamp();
        try {
            client.channels.cache.get(player.textChannelId).send({ embeds: [embed] });
        } catch (error) {
            console.error(error);
        }
    })
}
