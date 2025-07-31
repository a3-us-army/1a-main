import dotenv from 'dotenv';
dotenv.config();
import 'dotenv/config';
import { Router } from 'express';
import passport from '../middleware/passport.js';
import { getDatabase } from '../../bot/utils/database.js';
import fetch from 'node-fetch';

const router = Router();

const GUILD_ID = process.env.GUILD_ID;
const BOT_TOKEN = process.env.DISCORD_TOKEN;

router.get('/login', passport.authenticate('discord'));

router.get(
  '/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  async (req, res) => {
    const db = getDatabase();
    const user = req.user;

    console.log('User logging in:', user.id, user.username);

    // Check if user is banned from the Discord server
    let isBanned = false;
    let banReason = null;
    try {
      const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/bans/${user.id}`;
      console.log('Checking ban status at:', url);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
        },
      });
      console.log('Ban check HTTP status:', response.status);

      if (response.status === 200) {
        const data = await response.json();
        console.log('Ban data:', data);
        isBanned = true;
        banReason = data.reason || 'No reason provided.';
      } else if (response.status === 404) {
        console.log('User is NOT banned.');
      } else {
        const text = await response.text();
        console.warn('Unexpected ban check response:', response.status, text);
      }
    } catch (e) {
      console.error('Error checking Discord ban:', e);
      // Optionally treat as not banned, or as banned on error
    }

    if (isBanned) {
      console.log('User is banned, rendering banned page.');
      req.logout(() => {
        res.status(403).render('banned', {
          user: null,
          active: 'banned',
          banReason,
        });
      });
      return;
    }

    console.log('User is not banned, proceeding with login.');

    // Upsert user info
    db.prepare(
      `
      INSERT INTO users (id, username, discord_tag, avatar_url)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username=excluded.username,
        discord_tag=excluded.discord_tag,
        avatar_url=excluded.avatar_url
    `
    ).run(
      user.id,
      user.username,
      user.discriminator
        ? `${user.username}#${user.discriminator}`
        : user.username,
      user.avatar || user.avatar_url || null
    );

    res.redirect('/');
  }
);

router.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// Optional: direct access to banned page
router.get('/banned', (req, res) => {
  res.status(403).render('banned', {
    user: null,
    active: 'banned',
    banReason: null,
  });
});

export default router;
