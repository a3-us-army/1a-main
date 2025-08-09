import { Router } from 'express';
import fetch from 'node-fetch';
import { getAllStaffProfiles } from '../../../bot/utils/database.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const profiles = getAllStaffProfiles();
    const botToken = process.env.DISCORD_TOKEN;
    const guildId = process.env.GUILD_ID || '1332773894293160039';

    // Fetch Discord user data for each staff
    const users = await Promise.all(
      profiles.map(async (p) => {
        try {
          const userRes = await fetch(`https://discord.com/api/v10/users/${p.user_id}`, {
            headers: { Authorization: `Bot ${botToken}` },
          });
          const user = await userRes.json();
          // Fetch guild member for nickname
          let memberNick = null;
          try {
            const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${p.user_id}`, {
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (memberRes.ok) {
              const member = await memberRes.json();
              memberNick = member.nick || null;
            }
          } catch {}
          const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
            : '';
          const bannerUrl = user.banner
            ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${user.banner?.startsWith('a_') ? 'gif' : 'png'}?size=512`
            : null;
          return {
            profile: p,
            user,
            avatarUrl,
            bannerUrl,
            displayName: memberNick || user.global_name || user.username,
          };
        } catch (e) {
          return { profile: p, user: { id: p.user_id, username: 'Unknown' }, avatarUrl: '', bannerUrl: null, displayName: 'Unknown' };
        }
      })
    );

    res.render('content/staff', {
      user: req.user,
      active: 'staff',
      staffUsers: users,
    });
  } catch (err) {
    console.error('Failed to load staff:', err);
    res.status(500).render('error', { user: req.user, active: 'staff', title: 'Error', error: 'Failed to load staff page' });
  }
});

export default router;


