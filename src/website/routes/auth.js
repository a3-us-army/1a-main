import { Router } from "express";
import passport from "../middleware/passport.js";
import { getDatabase } from "../../bot/utils/database.js";

const router = Router();

router.get("/login", passport.authenticate("discord"));

router.get(
	"/auth/discord/callback",
	passport.authenticate("discord", { failureRedirect: "/" }),
	(req, res) => {
		// Get the database instance
		const db = getDatabase();

		// Get the user from the session
		const user = req.user;

		// Upsert user info
		db.prepare(`
      INSERT INTO users (id, username, discord_tag, avatar_url)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username=excluded.username,
        discord_tag=excluded.discord_tag,
        avatar_url=excluded.avatar_url
    `).run(
			user.id,
			user.username,
			user.discriminator
				? `${user.username}#${user.discriminator}`
				: user.username,
			user.avatar || user.avatar_url || null, // adjust as needed
		);

		res.redirect("/");
	},
);

router.get("/logout", (req, res) => {
	req.logout(() => res.redirect("/"));
});

export default router;
