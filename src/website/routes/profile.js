import { Router } from "express";
import ensureAuth from "../middleware/ensureAuth.js";
import fetch from "node-fetch";
import { isUserAdmin } from "../utils/discord.js"; // adjust path as needed

const router = Router();

router.get("/", ensureAuth, async (req, res) => {
	const discordId = req.user.id;
	const guildId = process.env.GUILD_ID;
	const botToken = process.env.DISCORD_TOKEN;

	try {
		// Fetch user info from Discord API
		const userRes = await fetch(
			`https://discord.com/api/v10/users/${discordId}`,
			{
				headers: { Authorization: `Bot ${botToken}` },
			},
		);
		const user = await userRes.json();

		// Fetch member info (for roles)
		const memberRes = await fetch(
			`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
			{
				headers: { Authorization: `Bot ${botToken}` },
			},
		);
		const member = await memberRes.json();

		// Fetch all roles in the guild
		const rolesRes = await fetch(
			`https://discord.com/api/v10/guilds/${guildId}/roles`,
			{
				headers: { Authorization: `Bot ${botToken}` },
			},
		);
		const allRoles = await rolesRes.json();

		// Get user's roles with color and name
		const userRoles = (member.roles || [])
			.map((roleId) => allRoles.find((r) => r.id === roleId))
			.filter(Boolean)
			.sort((a, b) => b.position - a.position);

		// Check admin status
		const isAdmin = await isUserAdmin(discordId);

		res.render("profile", {
			user: req.user,
			active: "profile",
			discordUser: user,
			bannerUrl: user.banner
				? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${user.banner.startsWith("a_") ? "gif" : "png"}?size=512`
				: null,
			avatarUrl: user.avatar
				? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
				: "",
			userRoles,
			isAdmin, // <-- pass to EJS
		});
	} catch (err) {
		console.error("Failed to fetch Discord profile info:", err);
		res.status(500).render("error", {
			user: req.user,
			active: "profile",
			error: "Failed to load Discord profile information.",
		});
	}
});

export default router;