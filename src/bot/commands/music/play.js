import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import client from '../../bot.js';

export const data = new SlashCommandBuilder()
    .setName('play')
    .setDescription("Play A Song!")
    .addStringOption(opt =>
        opt.setName('track').setDescription("Song/Playlist").setRequired(true)
    );

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
*/

//thanks chatgpt --Fried
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  // Pad seconds with leading zero if needed
  const paddedSeconds = seconds.toString().padStart(2, '0');
  return `${minutes}:${paddedSeconds}`;
}


export async function execute(interaction) {
    try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (member.user.bot) return;
        if (member.voice == null) return;

        const trackRequest = interaction.options.getString('track');

        const moonPlayer = client.moon.players.create({
            guildId: interaction.guildId,
            voiceChannelId: member.voice.channelId,
            textChannelId: interaction.channelId,
            autoPlay: false
        });

        if (!moonPlayer.connected) moonPlayer.connect({ setDeaf: true, setMute: false });

        const moonResult = await client.moon.search({
            query: `${trackRequest}`,
            source: "soundcloud",
            requester: member.user
        });

        const loadType = moonResult.loadType;

        if (loadType === 'error') {
            const embed = new EmbedBuilder()
                .setColor(0xFC3A28)
                .setTitle('❌ 1A Music')
                .setDescription('🚫 **Error loading the song.** Please try again or contact the developer.')
                .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png')
                .setFooter({
                    text: `Requested by ${interaction.user.displayName}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
        } 
        
        if (loadType === 'empty') {
            const embed = new EmbedBuilder()
                .setColor(0xFC3A28)
                .setTitle('❌ 1A Music')
                .setDescription('🔍 **No results found.** Try a different search term.')
                .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png')
                .setFooter({
                    text: `Requested by ${interaction.user.displayName}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
        }

        if (loadType === 'playlist') {
            for (const track of moonResult.tracks) {
                track.setRequester(member.user);
                moonPlayer.queue.add(track);
            }

            const embed = new EmbedBuilder()
                .setColor(0x2372CB)
                .setTitle('🎶 1A Music')
                .setDescription(`📀 **Added playlist with \`${moonResult.tracks.length}\` tracks to the queue.**`)
                .setThumbnail('https://cdn.xanderxx.xyz/1a-logo.png')
                .setFooter({
                    text: `Requested by ${interaction.user.displayName}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        const track = moonResult.tracks[0];
        track.setRequester(member.user);
        moonPlayer.queue.add(track);

        const embed = new EmbedBuilder()
            .setColor(0x2372CB)
            .setTitle('🎶 1A Music')
            .setThumbnail(track.artworkUrl || 'https://cdn.xanderxx.xyz/1a-logo.png')
            .setDescription(`🎵 **Added [${track.title}](${track.url}) to the queue.**`)
            .addFields(
                { name: 'Duration', value: `\`${formatDuration(track.duration) || 'Unknown'}\``, inline: true },
                { name: 'Author', value: `\`${track.author || 'Unknown'}\``, inline: true },
            )
            .setFooter({
                text: `Requested by ${interaction.user.displayName}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        if (!moonPlayer.playing) moonPlayer.play();

    } catch (error) {
        console.error('Error executing play command:', error);
    }
}
