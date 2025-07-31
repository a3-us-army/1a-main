import { EmbedBuilder } from 'discord.js';

export async function appealButtonHandler(interaction, client) {
  // Accept Appeal
  if (interaction.customId.startsWith('appeal_accept_')) {
    await interaction.deferUpdate();

    const parts = interaction.customId.split('_');
    const userId = parts.slice(-1)[0];

    let unbanSuccess = false;
    try {
      console.log('Attempting to unban user:', userId);
      await interaction.guild.bans.remove(userId, 'Appeal accepted');
      unbanSuccess = true;
      console.log('Unban successful for:', userId);
    } catch (e) {
      console.error('Unban failed for', userId, e);
      await interaction.followUp({
        content:
          '❌ Failed to unban the user. They may not be banned or the bot lacks permission.',
        ephemeral: true,
      });
      return; // Don't proceed if unban failed
    }

    // DM the user
    let dmSuccess = false;
    try {
      const user = await client.users.fetch(userId);
      await user.send(
        'Your ban appeal has been **accepted**! You have been unbanned from the Discord. Welcome back! https://discord.gg/UfbYumx5b9'
      );
      dmSuccess = true;
    } catch (e) {
      console.error('Failed to DM user after unban:', e);
      dmSuccess = false;
    }

    // Update the message
    try {
      await interaction.message.edit({
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x2ecc71)
            .addFields({
              name: 'Status',
              value: '✅ Accepted & Unbanned',
              inline: false,
            }),
        ],
        components: [],
      });
    } catch (e) {
      console.error('Failed to edit message after unban:', e);
    }

    await interaction.followUp({
      content: dmSuccess
        ? 'User unbanned and notified via DM.'
        : 'User unbanned, but DM failed.',
      ephemeral: true,
    });
  }

  // Deny Appeal
  if (interaction.customId.startsWith('appeal_deny_')) {
    await interaction.deferUpdate();

    const parts = interaction.customId.split('_');
    const userId = parts.slice(-1)[0];

    // DM the user about denial
    try {
      const user = await client.users.fetch(userId);
      await user.send(
        'Your ban appeal has been **denied**. If you have questions, contact staff.'
      );
    } catch (e) {
      console.error('Failed to DM user after denial:', e);
    }

    // Update the message
    try {
      await interaction.message.edit({
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0xe74c3c)
            .addFields({ name: 'Status', value: '❌ Denied', inline: false }),
        ],
        components: [],
      });
    } catch (e) {
      console.error('Failed to edit message after denial:', e);
    }

    await interaction.followUp({
      content: 'Appeal denied.',
      ephemeral: true,
    });
  }
}
