import { Router } from 'express';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { getDatabase } from '../../../bot/utils/database.js';
import fetchDiscordChannels from '../../utils/fetchChannels.js';
import { v4 as uuidv4 } from 'uuid';
const router = Router();

const db = getDatabase();

router.get('/', async (req, res) => {
  let isAdmin = false;
  if (req.user) {
    isAdmin = await import('../utils/discord.js').then(m =>
      m.isUserAdmin(req.user.id)
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const allEvents = db.prepare('SELECT * FROM events ORDER BY time ASC').all();
  const upcomingEvents = allEvents.filter(e => Number(e.time) >= now);
  const pastEvents = allEvents.filter(e => Number(e.time) < now).reverse(); // most recent first

  res.render('content/events', {
    user: req.user,
    events: upcomingEvents,
    pastEvents,
    alert: req.query.alert,
    error: req.query.error,
    isAdmin,
    active: 'dashboard',
  });
});

router.get('/new', ensureAdmin, async (req, res) => {
  const channelsData = await fetchDiscordChannels();
  res.render('forms/event_form', {
    user: req.user,
    event: null,
    action: 'Create',
    DISCORD_CHANNELS: channelsData,
    isAdmin: true,
    active: 'dashboard',
  });
});

router.get('/edit/:id', ensureAdmin, async (req, res) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(req.params.id);
  if (!event) return res.redirect('/events?error=Event not found');

  const channels = await fetchDiscordChannels();
  res.render('forms/event_form', {
    user: req.user,
    event,
    action: 'Edit',
    DISCORD_CHANNELS: channels,
    isAdmin: true,
    active: 'dashboard',
  });
});

router.post('/new', ensureAdmin, async (req, res) => {
  const { title, description, utc_time, location, channelId } = req.body;
  if (!title || !utc_time || !channelId)
    return res.redirect('/events?error=Title, time, and channel required');

  const id = uuidv4(); // Use UUID instead of timestamp
  const eventTime = Number(utc_time); // Already UTC seconds from frontend

  // --- POST TO DISCORD BOT API ---
  let messageId = null;
  try {
    const safeDescription = description?.trim()
      ? description.trim()
      : 'No description provided.';
    const event = {
      id: id, // Use the UUID we just generated
      title,
      description: safeDescription,
      time: eventTime,
      location,
      image: null,
      creator_id: req.user.id, // Add creator_id
    };
    const response = await fetch(process.env.BOT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
      },
      body: JSON.stringify({ channelId, event }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Bot API error:', data);
      return res.redirect('/events?error=Failed to post event to Discord.');
    }
    messageId = data.messageId;
  } catch (err) {
    console.error('Failed to post event to Discord:', err);
    return res.redirect('/events?error=Failed to post event to Discord.');
  }

  // Event is now stored in DB by the bot API
  // No need to duplicate the insertion here

  res.redirect('/events?alert=Event created!');
});

router.post('/edit/:id', ensureAdmin, async (req, res) => {
  const { title, description, utc_time, location, channelId } = req.body;
  db.prepare(
    'UPDATE events SET title = ?, description = ?, time = ?, location = ?, channel_id = ? WHERE id = ?'
  ).run(
    title,
    description,
    Number(utc_time),
    location,
    channelId,
    req.params.id
  );
  res.redirect('/events?alert=Event updated!');
});

router.post('/delete/:id', ensureAdmin, async (req, res) => {
  // Fetch event to get channel_id and message_id
  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(req.params.id);

  // Try to delete the Discord message if info is present
  if (event?.channel_id && event.message_id) {
    try {
      await fetch(
        process.env.BOT_API_URL.replace(
          /\/api\/post-event$/,
          '/api/delete-message'
        ),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
          },
          body: JSON.stringify({
            channelId: event.channel_id,
            messageId: event.message_id,
          }),
        }
      );
    } catch (err) {
      console.error('Failed to delete Discord message:', err);
    }
  }

  // Delete the event from the DB
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.redirect('/events?alert=Event deleted!');
});

export default router;
