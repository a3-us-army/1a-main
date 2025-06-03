import { Router } from "express";
import ensureAuth from "../middleware/ensureAuth.js";
import { getDatabase } from "../../bot/utils/database.js";
import fetch from "node-fetch";
const router = Router();

const db = getDatabase();

router.get("/", ensureAuth, (req, res) => {
	const db = getDatabase();
	const existing = db
		.prepare(
			"SELECT 1 FROM loa_requests WHERE user_id = ? AND status = 'pending'",
		)
		.get(req.user.id);
	const approvedLOAs = db
		.prepare(
			"SELECT * FROM loa_requests WHERE user_id = ? AND status = 'approved' ORDER BY begin_date DESC",
		)
		.all(req.user.id);
	res.render("loa", {
		user: req.user,
		active: "profile",
		alreadyRequested: !!existing,
		query: req.query,
		approvedLOAs, // pass to EJS
	});
});

router.post("/", ensureAuth, async (req, res) => {
	const { unitName, reason, beginDate, returnDate, firstLine } = req.body;

	// Prevent duplicate LOA requests (pending only)
	const db = getDatabase();
	const existing = db
		.prepare(
			"SELECT 1 FROM loa_requests WHERE user_id = ? AND status = 'pending'",
		)
		.get(req.user.id);
	if (existing) {
		return res.redirect("/loa?error=You already have a pending LOA request.");
	}

	// Send Discord notification via bot API (let the bot API handle DB insert and ID)
	try {
		const response = await fetch(
			process.env.BOT_API_URL.replace(/\/api\/post-event$/, "/api/post-loa"),
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
				},
				body: JSON.stringify({
					channelId: process.env.FORMS_CHANNEL_ID,
					event: {
						userId: req.user.id,
						unitName,
						reason,
						beginDate,
						returnDate,
						firstLine,
					},
				}),
			},
		);
		const text = await response.text();
		if (!response.ok) {
			console.error("Bot API error:", response.status, text);
			throw new Error("Failed to post LOA to Discord");
		}
		res.redirect("/loa?alert=LOA request submitted! We will contact you soon.");
	} catch (err) {
		console.error("LOA POST ERROR:", err);
		res.redirect("/loa?error=Failed to submit LOA. Please try again.");
	}
});

export default router;
