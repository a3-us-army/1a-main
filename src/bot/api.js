import express from 'express';
import { buildEventEmbed } from '../utils/rsvp_embed.js';
import { getDatabase, createApplication } from './utils/database.js';
import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

let discordClient = null;
export function setDiscordClient(client) {
  discordClient = client;
}

const apiApp = express();
apiApp.use(express.json());

apiApp.post('/api/post-event', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.BOT_API_SECRET}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { channelId, event } = req.body;
    if (!channelId || !event) {
      return res.status(400).json({ error: 'Missing channelId or event' });
    }
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res
        .status(404)
        .json({ error: 'Channel not found or not text-based' });
    }

    // --- FIX: Ensure event.time is an integer ---
    event.time = parseInt(event.time, 10);

    const { embed, components } = buildEventEmbed(event);
    const message = await channel.send({
      content: '<@&1363609382700712129>',
      embeds: [embed],
      components,
    });
    
    // Store event in database if it doesn't already exist
    try {
      const { createEvent } = await import('./utils/database.js');
      createEvent({
        id: event.id,
        creator_id: event.creator_id || 'website',
        title: event.title,
        description: event.description,
        time: event.time,
        location: event.location,
        image: event.image,
        message_id: message.id,
        channel_id: channelId,
      });
      console.log(`Event stored in database with ID: ${event.id}`);
    } catch (dbError) {
      console.error('Error storing event in database:', dbError);
      // Don't fail the request if DB storage fails
    }
    
    res.json({ messageId: message.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post event' });
  }
});

apiApp.post('/api/post-application', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.BOT_API_SECRET}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { application } = req.body;
    if (!application) {
      return res.status(400).json({ error: 'Missing application data' });
    }
    const channelId =
      process.env.APPLICATION_CHANNEL_ID || '1400617149978120332';
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res
        .status(404)
        .json({ error: 'Channel not found or not text-based' });
    }
    const applicationId = createApplication(application);
    const embed = new EmbedBuilder()
      .setTitle('New Application')
      .setColor(0x3498db)
      .addFields(
        {
          name: 'Applicant',
          value: `<@${application.userId}> (${application.username || 'N/A'})`,
          inline: false,
        },
        {
          name: 'How did you find the unit?',
          value: application.foundUnit || 'N/A',
          inline: false,
        },
        {
          name: 'Whats your steam64 ID?',
          value: application.steam64 || 'N/A',
          inline: false,
        },
        {
          name: 'What name do you want?',
          value: application.unitName || 'N/A',
          inline: false,
        },
        {
          name: 'How old are you?',
          value: application.age ? String(application.age) : 'N/A',
          inline: false,
        },
        {
          name: 'List any prior experience?',
          value: application.experience || 'None',
          inline: false,
        },
        {
          name: 'Whats your desired MOS/AFSC',
          value: application.mos || 'N/A',
          inline: true,
        }
      )
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_approve_${applicationId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`app_deny_${applicationId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
    );
    const message = await channel.send({
      content: '<@&1363618702733344768>',
      embeds: [embed],
      components: [row],
    });

    const db = getDatabase();

    // Update the database with the Discord message ID
    db.prepare(
      'UPDATE applications SET discord_message_id = ? WHERE id = ?'
    ).run(message.id, applicationId);

    res.json({ messageId: message.id, applicationId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post application' });
  }
});

apiApp.post('/api/post-loa', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.BOT_API_SECRET}`;
  if (authHeader !== expected) {
    console.error('LOA POST ERROR: Unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { event } = req.body;
    if (!event) {
      console.error('LOA POST ERROR: Missing event data', {
        event,
      });
      return res.status(400).json({ error: 'Missing event data' });
    }
    const channelId = process.env.LOA_CHANNEL_ID || '1400617293204951221';
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.error(
        'LOA POST ERROR: Channel not found or not text-based',
        channelId
      );
      return res
        .status(404)
        .json({ error: 'Channel not found or not text-based' });
    }
    const loaId = uuidv4(); // Always generate a new ID here
    const db = getDatabase();
    db.prepare(
      `
			INSERT INTO loa_requests
			(id, user_id, unit_name, reason, begin_date, return_date, first_line, submitted_at, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
		`
    ).run(
      loaId,
      event.userId,
      event.unitName,
      event.reason,
      event.beginDate,
      event.returnDate,
      event.firstLine,
      new Date().toISOString()
    );

    const embed = new EmbedBuilder()
      .setTitle('New LOA Request')
      .setColor(0xffc107)
      .addFields(
        { name: 'User', value: `<@${event.userId}>`, inline: true },
        { name: 'Unit Name', value: event.unitName, inline: true },
        { name: 'Reason', value: event.reason, inline: false },
        { name: 'Begin Date', value: event.beginDate, inline: true },
        { name: 'Return Date', value: event.returnDate, inline: true },
        { name: 'First Line', value: event.firstLine, inline: true }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`loa_approve_${loaId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`loa_deny_${loaId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
    );

    const message = await channel.send({
      content: '<@&1363626257887264808>',
      embeds: [embed],
      components: [row],
    });

    // Update the database with the Discord message ID
    db.prepare(
      'UPDATE loa_requests SET discord_message_id = ? WHERE id = ?'
    ).run(message.id, loaId);

    console.log('LOA posted to Discord, message ID:', message.id);
    res.json({ messageId: message.id, loaId });
  } catch (err) {
    console.error('LOA POST ERROR (bot API):', err);
    res
      .status(500)
      .json({ error: 'Failed to post event', details: err.message });
  }
});

apiApp.get('/api/channels', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.BOT_API_SECRET}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const guild = await discordClient.guilds.fetch(process.env.GUILD_ID);
    const fullGuild = await guild.fetch();
    const channels = await fullGuild.channels.fetch();
    const categories = [];
    const textChannels = [];
    for (const [, channel] of channels) {
      if (channel.type === 4) {
        categories.push({ id: channel.id, name: channel.name });
      } else if (channel.type === 0) {
        textChannels.push({
          id: channel.id,
          name: channel.name,
          parentId: channel.parentId,
        });
      }
    }
    res.json({ categories, textChannels });
  } catch (err) {
    console.error('Failed to fetch channels:', err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

apiApp.post('/api/delete-message', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.BOT_API_SECRET}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { channelId, messageId } = req.body;
  if (!channelId || !messageId) {
    return res.status(400).json({ error: 'Missing channelId or messageId' });
  }
  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res
        .status(404)
        .json({ error: 'Channel not found or not text-based' });
    }
    const message = await channel.messages.fetch(messageId);
    await message.delete();
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

apiApp.post('/api/request-cert', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.BOT_API_SECRET}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { userId, cert, requestId } = req.body;
    const channelId = process.env.CERT_CHANNEL_ID || '1400616901440307230';
    if (!userId || !cert) {
      return res.status(400).json({ error: 'Missing data' });
    }
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    const embed = new EmbedBuilder()
      .setTitle('Certification Request')
      .setDescription(`User: <@${userId}>`)
      .addFields(
        { name: 'Certification', value: cert.name, inline: true },
        {
          name: 'Description',
          value: cert.description || 'No description',
          inline: false,
        },
        {
          name: 'Requested At',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
        { name: 'Request ID', value: requestId, inline: true }
      )
      .setColor(0xffa500);
    const approveBtn = new ButtonBuilder()
      .setCustomId(`cert_approve_${requestId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success);
    const denyBtn = new ButtonBuilder()
      .setCustomId(`cert_deny_${requestId}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
    const message = await channel.send({ embeds: [embed], components: [row] });

    // Update the database with the Discord message ID
    const db = getDatabase();
    db.prepare(
      'UPDATE certification_requests SET discord_message_id = ? WHERE id = ?'
    ).run(message.id, requestId);

    res.json({ success: true });
  } catch (err) {
    console.error('Error posting cert request to Discord:', err);
    res.status(500).json({ error: 'Failed to post to Discord' });
  }
});

apiApp.post('/api/post-equipment', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.BOT_API_SECRET}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { userId, username, equipment, event, quantity, requestId } =
      req.body;
    const channelId = process.env.FORMS_CHANNEL_ID;
    if (
      !userId ||
      !equipment ||
      !event ||
      !quantity ||
      !channelId ||
      !requestId
    ) {
      return res.status(400).json({ error: 'Missing data' });
    }
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    const embed = new EmbedBuilder()
      .setTitle('Equipment Request')
      .setDescription(`User: <@${userId}> (${username || userId})`)
      .addFields(
        { name: 'Equipment', value: equipment.name, inline: true },
        { name: 'Quantity', value: String(quantity), inline: true },
        { name: 'Event', value: event.title, inline: false },
        {
          name: 'Event Date',
          value: event.time ? `<t:${Math.floor(Number(event.time))}:F>` : 'N/A',
          inline: true,
        },
        {
          name: 'Requested At',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
        { name: 'Request ID', value: requestId, inline: false }
      )
      .setColor(0x1e90ff);
    const approveBtn = new ButtonBuilder()
      .setCustomId(`app_eq_${requestId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success);
    const denyBtn = new ButtonBuilder()
      .setCustomId(`den_eq_${requestId}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
    await channel.send({ embeds: [embed], components: [row] });
    res.json({ success: true });
  } catch (err) {
    console.error('Error posting equipment request to Discord:', err);
    res.status(500).json({ error: 'Failed to post to Discord' });
  }
});

// --- Secure middleware ---
function requireBotStatusSecret(req, res, next) {
  const expected = `Bearer ${process.env.BOT_STATUS_SECRET}`;
  const authHeader = req.headers.authorization;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
apiApp.post('/api/post-form', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.BOT_API_SECRET}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { embed, pingRole } = req.body;
    if (!embed) {
      return res.status(400).json({ error: 'Missing embed data' });
    }
    const channelId =
      process.env.CUSTOM_FORMS_CHANNEL_ID || '1400618878610047092';
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    await channel.send({
      content: pingRole || '',
      embeds: [embed],
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error posting form to Discord:', err);
    res.status(500).json({ error: 'Failed to post form' });
  }
});

// --- Status endpoint ---
apiApp.get('/api/bot-status', requireBotStatusSecret, (req, res) => {
  const status = {
    tag: discordClient.user?.tag || 'Unknown',
    id: discordClient.user?.id || 'Unknown',
    status: discordClient.ws.status === 0 ? 'Online' : 'Offline',
    guilds: discordClient.guilds.cache.size,
    users: discordClient.users.cache.size,
    uptime: process.uptime(),
    memoryMB: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
    nodeVersion: process.version,
    lastReady: discordClient.readyAt
      ? discordClient.readyAt.toISOString()
      : null,
  };
  res.json(status);
});

// --- Restart endpoint ---
apiApp.post('/api/bot-restart', requireBotStatusSecret, (req, res) => {
  res.json({ restarting: true });
  setTimeout(() => process.exit(0), 500); // PM2/systemd will restart the process
});

apiApp.post('/api/post-appeal', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.BOT_API_SECRET}`;
  if (authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { appeal } = req.body;
    if (!appeal) {
      return res.status(400).json({ error: 'Missing appeal data' });
    }
    const channelId = process.env.APPEALS_CHANNEL_ID || '1400618798964539553';
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res
        .status(404)
        .json({ error: 'Channel not found or not text-based' });
    }

    // Fetch ban reason from Discord
    const GUILD_ID = process.env.GUILD_ID;
    const BOT_TOKEN = process.env.DISCORD_TOKEN;
    let banReason = 'Unknown or not available.';
    try {
      const banRes = await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/bans/${appeal.userId}`,
        {
          headers: { Authorization: `Bot ${BOT_TOKEN}` },
        }
      );
      if (banRes.status === 200) {
        const banData = await banRes.json();
        banReason = banData.reason || 'No reason provided.';
      } else if (banRes.status === 404) {
        banReason = 'User is not currently banned.';
      }
    } catch (e) {
      console.error('Failed to fetch ban reason:', e);
    }

    const db = getDatabase();
    const appealId = uuidv4();
    db.prepare(
      `
			INSERT INTO appeals (id, user_id, username, reason, details, submitted_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`
    ).run(
      appealId,
      appeal.userId,
      appeal.username,
      appeal.reason,
      appeal.details || '',
      new Date().toISOString()
    );

    const embed = new EmbedBuilder()
      .setTitle('New Ban Appeal')
      .setColor(0xffc107)
      .addFields(
        {
          name: 'User',
          value: `<@${appeal.userId}> (${appeal.username || 'N/A'})`,
          inline: false,
        },
        { name: 'Reason', value: appeal.reason, inline: false },
        { name: 'Details', value: appeal.details || 'None', inline: false },
        { name: 'Original Ban Reason', value: banReason, inline: false }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`appeal_accept_${appealId}_${appeal.userId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`appeal_deny_${appealId}_${appeal.userId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
    );

    const message = await channel.send({
      embeds: [embed],
      components: [row],
    });

    // Update the database with the Discord message ID
    db.prepare('UPDATE appeals SET discord_message_id = ? WHERE id = ?').run(
      message.id,
      appealId
    );

    res.json({ messageId: message.id, appealId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post appeal' });
  }
});
export default apiApp;
