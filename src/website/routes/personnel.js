import { Router } from "express";
import ensureAdmin from "../middleware/ensureAdmin.js";
import ensureAuth from "../middleware/ensureAuth.js";
import { getDatabase } from "../../bot/utils/database.js";
import { fetchDiscordAvatar } from "../utils/discord.js";
const router = Router();

const db = getDatabase();

router.get("/", async (req, res) => {
	let isAdmin = false;
	if (req.user) {
		isAdmin = await import("../utils/discord.js").then((m) =>
			m.isUserAdmin(req.user.id)
		);
	}
	res.render("personnel", {
		user: req.user,
		active: "dashboard",
		isAdmin,
	});
});

router.get("/api/personnel", async (req, res) => {
	const { search } = req.query;
	let sql = `
    SELECT * FROM personnel
    WHERE 1=1
  `;
	const params = [];
	if (search) {
		sql += " AND (role LIKE ? OR mos LIKE ? OR name LIKE ?)";
		params.push(`%${search}%`, `%${search}%`, `%${search}%`);
	}
	sql += `
    ORDER BY platoon_order, platoon, squad_order, squad, sort_order, position, name
  `;
	const personnel = db.prepare(sql).all(...params);
	res.json(personnel);
});

router.post("/api/personnel/add", ensureAdmin, async (req, res) => {
	const {
		discord_id,
		discord_username,
		name,
		position,
		callsign,
		role,
		status,
		squad,
		platoon,
	} = req.body;

	// Fetch avatar
	const botToken = process.env.DISCORD_TOKEN;
	const discord_avatar = await fetchDiscordAvatar(discord_id, botToken);

	db.prepare(
		`
    INSERT INTO personnel (discord_id, discord_username, name, position, callsign, role, status, squad, platoon, discord_avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
	).run(
		discord_id,
		discord_username,
		name,
		position,
		callsign,
		role,
		status,
		squad,
		platoon,
		discord_avatar,
	);
	res.json({ success: true });
});

router.post("/api/personnel/update-full", ensureAdmin, async (req, res) => {
	const {
		id,
		discord_id,
		discord_username,
		name,
		position,
		callsign,
		role,
		status,
		squad,
		platoon,
	} = req.body;
	db.prepare(
		`
    UPDATE personnel SET
      discord_id = ?, discord_username = ?, name = ?, position = ?, callsign = ?, role = ?, status = ?, squad = ?, platoon = ?
    WHERE id = ?
  `,
	).run(
		discord_id,
		discord_username,
		name,
		position,
		callsign,
		role,
		status,
		squad,
		platoon,
		id,
	);
	res.json({ success: true });
});

router.post("/api/personnel/delete", ensureAdmin, async (req, res) => {
	db.prepare("DELETE FROM personnel WHERE id = ?").run(req.body.id);
	res.json({ success: true });
});

router.post("/api/personnel/reorder", ensureAdmin, async (req, res) => {
	const { squad, ids } = req.body;
	if (!Array.isArray(ids))
		return res.status(400).json({ error: "Invalid data" });
	ids.forEach((id, idx) => {
		db.prepare("UPDATE personnel SET sort_order = ? WHERE id = ?").run(idx, id);
	});
	res.json({ success: true });
});

router.post("/api/personnel/reorder-squads", ensureAdmin, async (req, res) => {
	const { platoon, squads } = req.body;
	if (!Array.isArray(squads))
		return res.status(400).json({ error: "Invalid data" });
	squads.forEach((squad, idx) => {
		db.prepare(
			"UPDATE personnel SET squad_order = ? WHERE platoon = ? AND squad = ?",
		).run(idx, platoon, squad);
	});
	res.json({ success: true });
});

router.post(
	"/api/personnel/reorder-platoons",
	ensureAdmin,
	async (req, res) => {
		const { platoons } = req.body;
		if (!Array.isArray(platoons))
			return res.status(400).json({ error: "Invalid data" });
		platoons.forEach((platoon, idx) => {
			db.prepare(
				"UPDATE personnel SET platoon_order = ? WHERE platoon = ?",
			).run(idx, platoon);
		});
		res.json({ success: true });
	},
);

export default router;
