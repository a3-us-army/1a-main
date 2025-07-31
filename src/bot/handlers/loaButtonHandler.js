import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getDatabase } from '../utils/database.js'; // adjust path as needed

export async function handleLOAButton(interaction) {
  const db = getDatabase();

  // Approve
  if (interaction.customId.startsWith('loa_approve_')) {
    const loaId = interaction.customId.replace('loa_approve_', '');
    const loa = db
      .prepare('SELECT * FROM loa_requests WHERE id = ?')
      .get(loaId);
    if (!loa) {
      return interaction.reply({
        content: 'LOA request not found.',
        ephemeral: true,
      });
    }
    db.prepare(
      "UPDATE loa_requests SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?"
    ).run(interaction.user.id, new Date().toISOString(), loaId);

    const embed = new EmbedBuilder()
      .setTitle('LOA Approved')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'User', value: `<@${loa.user_id}>`, inline: true },
        { name: 'Unit Name', value: loa.unit_name, inline: true },
        { name: 'Reason', value: loa.reason, inline: false },
        { name: 'Begin Date', value: loa.begin_date, inline: true },
        { name: 'Return Date', value: loa.return_date, inline: true },
        { name: 'First Line', value: loa.first_line, inline: true },
        { name: 'Status', value: '✅ Approved', inline: true }
      )
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });

    // DM the user
    try {
      const user = await interaction.client.users.fetch(loa.user_id);
      await user.send(
        'Your LOA request has been **approved**. Enjoy your leave!'
      );
    } catch (e) {
      console.error('Could not DM LOA applicant:', e);
    }
  }

  // Deny
  if (interaction.customId.startsWith('loa_deny_')) {
    const loaId = interaction.customId.replace('loa_deny_', '');
    const loa = db
      .prepare('SELECT * FROM loa_requests WHERE id = ?')
      .get(loaId);
    if (!loa) {
      return interaction.reply({
        content: 'LOA request not found.',
        ephemeral: true,
      });
    }
    db.prepare(
      "UPDATE loa_requests SET status = 'denied', denied_by = ?, denied_at = ? WHERE id = ?"
    ).run(interaction.user.id, new Date().toISOString(), loaId);

    const embed = new EmbedBuilder()
      .setTitle('LOA Denied')
      .setColor(0xe74c3c)
      .addFields(
        { name: 'User', value: `<@${loa.user_id}>`, inline: true },
        { name: 'Unit Name', value: loa.unit_name, inline: true },
        { name: 'Reason', value: loa.reason, inline: false },
        { name: 'Begin Date', value: loa.begin_date, inline: true },
        { name: 'Return Date', value: loa.return_date, inline: true },
        { name: 'First Line', value: loa.first_line, inline: true },
        { name: 'Status', value: '❌ Denied', inline: true }
      )
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });

    // DM the user
    try {
      const user = await interaction.client.users.fetch(loa.user_id);
      await user.send(
        'Your LOA request has been **denied**. Please contact your first line for more information.'
      );
    } catch (e) {
      console.error('Could not DM LOA applicant:', e);
    }
  }
}
