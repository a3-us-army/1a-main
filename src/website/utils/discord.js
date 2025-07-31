import fetch from "node-fetch";

const ADMIN_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const adminCache = new Map(); // userId -> { isAdmin, expires }

export async function isUserAdmin(userId) {
	const guildId = process.env.GUILD_ID;
	const botToken = process.env.DISCORD_TOKEN;
	if (!guildId || !botToken) {
		console.error(
			"[ADMIN CHECK] Missing GUILD_ID or BOT_TOKEN in environment.",
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
			},
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
			},
		);
		const rolesText = await rolesRes.text();
		const roles = JSON.parse(rolesText);

		const memberRoleIds = member.roles || [];

		for (const roleId of memberRoleIds) {
			const role = roles.find((r) => r.id === roleId);
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
		console.error("Failed to check admin status:", err);
		adminCache.set(userId, {
			isAdmin: false,
			expires: now + ADMIN_CACHE_DURATION,
		});
		return false;
	}
}

export async function fetchDiscordAvatar(discord_id, botToken) {
	try {
		const res = await fetch(`https://discord.com/api/v10/users/${discord_id}`, {
			headers: { Authorization: `Bot ${botToken}` },
		});
		if (!res.ok) return null;
		const user = await res.json();
		return user.avatar || null;
	} catch (e) {
		console.error("Failed to fetch Discord avatar:", e);
		return null;
	}
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
		console.error("[GUILD CHECK] Missing GUILD_ID or BOT_TOKEN in environment.");
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
		console.error("Failed to check guild membership:", err);
		return false;
	}
}
