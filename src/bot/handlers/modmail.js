// handlers/modmail.js
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} from 'discord.js';
import {
  isUserBlocked,
  findOrCreateModmailChannel,
  postUserMessageToChannel,
  syncEdit,
  syncDelete,
  addMessageMapping,
  getMappedMessageIdByDm,
  getMappedMessageIdByModmail,
  removeMessageMapping,
  saveTranscript,
  uploadTranscriptToR2,
  tagThread,
  extractUserIdFromTopic,
} from '../utils/modmail.js';
import {
  MODMAIL_CATEGORY_ID,
  STAFF_ROLE_ID,
  LOG_CHANNEL_ID,
  WELCOME_MESSAGE,
} from '../config/modmail.js';

export default function modmailHandler(client) {
  // Handle DMs to the bot
  client.on('messageCreate', async message => {
    if (message.channel.type !== ChannelType.DM || message.author.bot) return;
    if (await isUserBlocked(message.author.id)) return;

    const modmailChannel = await findOrCreateModmailChannel(
      message.author,
      client
    );

    // If this is the first message in the channel, send a welcome message to the user
    if (modmailChannel.lastMessageId === null) {
      await message.author
        .send({
          content:
            '👋 Thank you for contacting support! A staff member will respond to you here as soon as possible. Please describe your issue in detail.',
        })
        .catch(() => {});
    }

    // Post the user's message as embed with buttons, and store mapping
    const modmailMsg = await postUserMessageToChannel(
      message,
      modmailChannel,
      true
    );
    await addMessageMapping(message.id, modmailMsg.id, modmailChannel.id);
  });

  // Sync DM edits to modmail channel
  client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (oldMsg.channel.type !== ChannelType.DM || oldMsg.author.bot) return;
    await syncEdit(oldMsg, newMsg, client);
  });

  // Sync DM deletes to modmail channel
  client.on('messageDelete', async msg => {
    if (msg.channel.type !== ChannelType.DM || msg.author.bot) return;
    await syncDelete(msg, client);
  });

  // Staff reply: send to user DM (no embed/auto-delete in thread)
  client.on('messageCreate', async message => {
    if (
      message.guild &&
      message.channel.parentId === MODMAIL_CATEGORY_ID &&
      message.channel.name.startsWith('modmail-')
    ) {
      // Extract user ID from channel topic
      const topic = message.channel.topic || '';
      const userId = extractUserIdFromTopic(topic);
      if (!userId) return;
      const user = await message.client.users.fetch(userId).catch(() => null);
      if (!user) return;

      // Don't send the initial thread creation embed or system messages
      if (message.type !== 0) return;

      // Ignore messages that are only embeds (no text content)
      if (!message.content && message.embeds.length > 0) return;

      // Ignore messages that start with "!!"
      if (message.content && message.content.startsWith('!!')) return;

      // Build the embed for the user DM
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setAuthor({
          name: `${message.member?.displayName || message.author.tag} (Staff)`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(message.content || '*No text content*')
        .setFooter({ text: `Reply from ${message.guild.name}` })
        .setTimestamp();

      // Attachments
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (
          attachment.contentType &&
          attachment.contentType.startsWith('image/')
        ) {
          embed.setImage(attachment.url);
        } else {
          embed.addFields({
            name: 'Attachment',
            value: `[File](${attachment.url})`,
            inline: false,
          });
        }
      }

      // Send the embed to the user (DM)
      await user.send({ embeds: [embed] }).catch(() => {
        message.channel.send('❌ Could not DM the user (DMs may be closed).');
      });
    }
  });

  // If the embed in the thread is deleted, delete the corresponding DM (no longer needed, but kept for completeness)
  client.on('messageDelete', async deletedMsg => {
    if (
      deletedMsg.guild &&
      deletedMsg.channel.parentId === MODMAIL_CATEGORY_ID &&
      deletedMsg.channel.name.startsWith('modmail-')
    ) {
      // No action needed since we no longer auto-create embeds in the thread
    }
  });

  // Handle button interactions in modmail channels
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const { customId, channel, user } = interaction;

    if (customId === 'close_thread') {
      // Close thread, upload transcript, notify user, delete channel
      const topic = channel.topic || '';
      const userId = extractUserIdFromTopic(topic);
      const transcriptPath = await saveTranscript(channel);
      let r2Url = null;
      try {
        const fileName = `transcript-${channel.id}-${Date.now()}.txt`;
        r2Url = await uploadTranscriptToR2(transcriptPath, fileName);
      } catch (e) {
        console.error('R2 upload failed:', e);
        r2Url = null;
      }

      // Log to log channel
      const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
      let threadUserTag = 'Unknown User';
      let threadUserMention = userId ? `<@${userId}>` : 'Unknown';
      try {
        const threadUser = await client.users.fetch(userId);
        threadUserTag = `${threadUser.tag} (${threadUserMention})`;
      } catch {
        threadUserTag = `Unknown User (${userId})`;
      }

      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Modmail Closed')
            .setDescription(
              `Closed by ${user.tag} (<@${user.id}>)

                            **Thread for:** ${threadUserTag}
                            
                            [Transcript](${r2Url || 'Upload failed'})`
            )
            .setTimestamp(),
        ],
      });

      // Notify user
      if (userId) {
        try {
          const dmUser = await client.users.fetch(userId);
          await dmUser.send({
            content:
              'Your modmail thread has been closed. If you need further assistance, feel free to DM me again!',
          });
        } catch (e) {
          console.error('Failed to send close DM:', e);
        }
      }

      await interaction.reply({
        content: 'Thread closed and transcript uploaded.',
        ephemeral: true,
      });
      setTimeout(() => channel.delete(), 5000);
    }

    if (customId === 'tag_thread') {
      await tagThread(channel, 'tagged');
      await interaction.reply({ content: 'Thread tagged.', ephemeral: true });
    }
  });
}
