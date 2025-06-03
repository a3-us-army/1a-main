import { Router } from "express";
import ensureAuth from "../middleware/ensureAuth.js";
import { isUserAdmin } from "../utils/discord.js";
import { getDatabase } from "../../bot/utils/database.js";
const router = Router();

const db = getDatabase();

router.get("/", ensureAuth, async (req, res) => {
	const existing = db
		.prepare("SELECT 1 FROM applications WHERE user_id = ?")
		.get(req.user.id);
	const isAdmin = await isUserAdmin(req.user.id);
	let allApplications = [];
	if (isAdmin) {
		allApplications = db
			.prepare("SELECT * FROM applications ORDER BY submitted_at DESC")
			.all();
	}
	res.render("apply", {
		user: req.user,
		active: "application",
		alreadyApplied: !!existing,
		query: req.query,
		isAdmin,
		allApplications,
	});
});

router.post("/", ensureAuth, async (req, res) => {
	const { foundUnit, steam64, unitName, age, experience, mos } = req.body;

	// Check if user has already applied
	const existing = await db
		.prepare("SELECT 1 FROM applications WHERE user_id = ?")
		.get(req.user.id);
	if (existing) {
		return res.redirect(
			"/apply?error=You have already submitted an application.",
		);
	}

	// Save to DB if you want (not shown here)

	// Send to bot API for Discord posting
	try {
        const response = await fetch(
            process.env.BOT_API_URL.replace(
                /\/api\/post-event$/,
                "/api/post-application",
            ),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
                },
                body: JSON.stringify({
                    application: {
                        userId: req.user.id,
                        username: req.user.username,
                        foundUnit,
                        steam64,
                        discordUsername: req.user.username,
                        unitName,
                        age,
                        experience,
                        mos,
                    },
                    channelId: process.env.FORMS_CHANNEL_ID,
                }),
            }
        );
        if (!response.ok) {
            const text = await response.text();
            console.error("Discord API error:", response.status, text);
            throw new Error("Failed to post application to Discord");
        }
        res.redirect(
            "/apply?alert=Application submitted! We will contact you soon.",
        );
    } catch (err) {
        console.error(err);
        res.redirect(
            "/apply?error=Failed to submit application. Please try again.",
        );
    }
});

export default router;
