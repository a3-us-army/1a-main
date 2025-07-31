import fetch from 'node-fetch';

const ADMIN_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const adminCache = new Map(); // userId -> { isAdmin, expires }

export async function isUserAdmin(userId) {
  const guildId = process.env.GUILD_ID;
  const botToken = process.env.DISCORD_TOKEN;
  if (!guildId || !botToken) {
    console.error(
      '[ADMIN CHECK] Missing GUILD_ID or BOT_TOKEN in environment.'
    );
    return false;
  }

  // Check cache first
  const cached = adminCache.get(userId);
  const now = Date.now();
  if (cached && cached.expires > now) {
    console.log(`[ADMIN CACHE] User ${userId} isAdmin: ${cached.isAdmin}`);
    return cached.isAdmin;
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      {
        headers: { Authorization: `Bot ${botToken}` },
      }
    );
    const text = await res.text();

    if (!res.ok) {
      adminCache.set(userId, {
        isAdmin: false,
        expires: now + ADMIN_CACHE_DURATION,
      });
      return false;
    }
    const member = JSON.parse(text);

    const ADMINISTRATOR = 0x00000008;

    const rolesRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      {
        headers: { Authorization: `Bot ${botToken}` },
      }
    );
    const rolesText = await rolesRes.text();
    const roles = JSON.parse(rolesText);

    const memberRoleIds = member.roles || [];

    for (const roleId of memberRoleIds) {
      const role = roles.find(r => r.id === roleId);
      if (role) {
        if (BigInt(role.permissions) & BigInt(ADMINISTRATOR)) {
          adminCache.set(userId, {
            isAdmin: true,
            expires: now + ADMIN_CACHE_DURATION,
          });
          return true;
        }
      }
    }
    adminCache.set(userId, {
      isAdmin: false,
      expires: now + ADMIN_CACHE_DURATION,
    });
    return false;
  } catch (err) {
    console.error('Failed to check admin status:', err);
    adminCache.set(userId, {
      isAdmin: false,
      expires: now + ADMIN_CACHE_DURATION,
    });
    return false;
  }
}

export async function fetchDiscordAvatar(discord_id, botToken) {
  try {
    const response = await fetch(
      `https://cdn.discordapp.com/avatars/${discord_id}/${discord_id}.png`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Error fetching Discord avatar:', error);
    return false;
  }
}

export async function getUserRoles(userId) {
  const guildId = process.env.GUILD_ID;
  const botToken = process.env.DISCORD_TOKEN;

  if (!guildId || !botToken) {
    console.error(
      '[GET USER ROLES] Missing GUILD_ID or BOT_TOKEN in environment.'
    );
    return [];
  }

  try {
    // Fetch member info (for roles)
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      {
        headers: { Authorization: `Bot ${botToken}` },
      }
    );

    if (!memberRes.ok) {
      return [];
    }

    const member = await memberRes.json();

    // Fetch all roles in the guild
    const rolesRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      {
        headers: { Authorization: `Bot ${botToken}` },
      }
    );

    if (!rolesRes.ok) {
      return [];
    }

    const allRoles = await rolesRes.json();

    // Get user's roles with both ID and name
    const userRoles = (member.roles || [])
      .map(roleId => allRoles.find(r => r.id === roleId))
      .filter(Boolean)
      .map(role => ({ id: role.id, name: role.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return userRoles;
  } catch (err) {
    console.error('Failed to get user roles:', err);
    return [];
  }
}

// Get user role names only (for backward compatibility)
export async function getUserRoleNames(userId) {
  const userRoles = await getUserRoles(userId);
  return userRoles.map(role => role.name);
}

// Get only the specific MOS roles that should be used for certifications
// Using role IDs for exact matching instead of names
export function getAvailableMOSRoles() {
  return [
    { id: '1363616859643183165', name: '11A - Infantry Officer' },
    { id: '1363616482306687077', name: '11B - Infantryman' },
    { id: '1363616521535885502', name: '11C - Mortarman' },
    { id: '1363616586992189530', name: '13F - Joint Fire Support Specialist' },
    { id: '1363616545292550425', name: '68W - Combat Medic' },
    { id: '1363633285661462598', name: '1Z3X1 - Tactical Air Control Party' },
    { id: '1363616632873947258', name: '153A - Rotary Wing Aviator' },
    { id: '1363616679296499763', name: '11F1X - Fixed Wing Aviator' },
  ];
}

// Helper function to get MOS role names for display
export function getAvailableMOSRoleNames() {
  return getAvailableMOSRoles().map(role => role.name);
}

// Helper function to get MOS role by ID
export function getMOSRoleById(roleId) {
  return getAvailableMOSRoles().find(role => role.id === roleId);
}

// Helper function to get MOS role by name
export function getMOSRoleByName(roleName) {
  return getAvailableMOSRoles().find(role => role.name === roleName);
}

/**
 * Checks if a user is a member of the guild.
 * @param {string} userId - The Discord user ID.
 * @returns {Promise<boolean>}
 */
export async function isUserInGuild(userId) {
  const guildId = process.env.GUILD_ID;
  const botToken = process.env.DISCORD_TOKEN;
  if (!guildId || !botToken) {
    console.error(
      '[GUILD CHECK] Missing GUILD_ID or BOT_TOKEN in environment.'
    );
    return false;
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      {
        headers: { Authorization: `Bot ${botToken}` },
      }
    );
    return res.ok;
  } catch (err) {
    console.error('Failed to check guild membership:', err);
    return false;
  }
}
