import { Router } from "express";
import ensureAdmin from "../middleware/ensureAdmin.js";
import ensureAuth from "../middleware/ensureAuth.js";
import { isUserAdmin } from "../utils/discord.js";
import { getDatabase } from "../../bot/utils/database.js";
const router = Router();

const db = getDatabase();

router.get("/", ensureAuth, async (req, res) => {
	const certs = db
		.prepare("SELECT * FROM certifications ORDER BY name ASC")
		.all();
	const isAdmin = await isUserAdmin(req.user.id);
	let userRequests = [];
	if (req.user) {
		// If isUserAdmin is async, you need to await it, so this route should be async
		// But for now, let's keep it simple and synchronous
		// If you need isAdmin, make this route async and await isUserAdmin
		userRequests = db
			.prepare("SELECT * FROM certification_requests WHERE user_id = ?")
			.all(req.user.id);
	}
	res.render("certs", {
		user: req.user,
		certs,
		userRequests,
		alert: req.query.alert,
		error: req.query.error,
		isAdmin,
		active: "dashboard",
	});
});

router.get("/new", ensureAdmin, (req, res) => {
	res.render("cert_form", {
		user: req.user,
		cert: null,
		action: "Create",
		isAdmin: true,
		active: "dashboard",
		alert: req.query.alert || "",
		error: req.query.error || "",
		certs: [],
	});
});

router.get("/edit/:id", ensureAdmin, (req, res) => {
	const cert = db
		.prepare("SELECT * FROM certifications WHERE id = ?")
		.get(req.params.id);
	if (!cert) return res.redirect("/certs?error=Certification not found");
	res.render("cert_form", {
		user: req.user,
		cert,
		action: "Edit",
		isAdmin: true,
		active: "dashboard",
		alert: req.query.alert || "",
		error: req.query.error || "",
		certs: [],
	});
});

router.post("/new", ensureAdmin, (req, res) => {
	const { name, description } = req.body;
	if (!name) return res.redirect("/certs?error=Name required");
	const id = Date.now().toString();
	db.prepare(
		"INSERT INTO certifications (id, name, description) VALUES (?, ?, ?)",
	).run(id, name, description);
	res.redirect("/certs?alert=Certification created!");
});

router.post("/edit/:id", ensureAdmin, (req, res) => {
	const { name, description } = req.body;
	db.prepare(
		"UPDATE certifications SET name = ?, description = ? WHERE id = ?",
	).run(name, description, req.params.id);
	res.redirect("/certs?alert=Certification updated!");
});

router.post("/delete/:id", ensureAdmin, (req, res) => {
	const certId = req.params.id;
	try {
		// Delete all requests for this cert first
		db.prepare("DELETE FROM certification_requests WHERE cert_id = ?").run(
			certId,
		);
		// Then delete the cert itself
		db.prepare("DELETE FROM certifications WHERE id = ?").run(certId);
		res.redirect("/certs?alert=Certification deleted!");
	} catch (err) {
		console.error("Error deleting certification:", err);
		res.redirect("/certs?error=Failed to delete certification.");
	}
});

router.post("/request/:id", ensureAuth, async (req, res) => {
	const certId = req.params.id;
	const userId = req.user.id;
	const cert = db
		.prepare("SELECT * FROM certifications WHERE id = ?")
		.get(certId);

	const existing = db
		.prepare(
			"SELECT * FROM certification_requests WHERE user_id = ? AND cert_id = ? AND status IN ('pending', 'approved')",
		)
		.get(userId, certId);

	if (existing)
		return res.redirect(
			"/certs?error=You already have a pending or approved request for this cert.",
		);

	const requestId = Date.now().toString();
	db.prepare(
		"INSERT INTO certification_requests (id, user_id, cert_id, requested_at) VALUES (?, ?, ?, ?)",
	).run(requestId, userId, certId, new Date().toISOString());

	// --- POST TO DISCORD BOT API ---
	try {
		await fetch(
			process.env.BOT_API_URL.replace(
				/\/api\/post-event$/,
				"/api/request-cert",
			),
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
				},
				body: JSON.stringify({
					userId,
					cert,
					requestId,
				}),
			},
		);
	} catch (err) {
		console.error("Failed to post cert request to Discord:", err);
	}

	res.redirect("/certs?alert=Certification requested!");
});

router.get("/my-certs", ensureAuth, (req, res) => {
	const userId = req.user.id;
	const certs = db
		.prepare("SELECT * FROM certifications ORDER BY name ASC")
		.all();
	const requests = db
		.prepare(
			`SELECT cr.*, c.name AS cert_name, c.description AS cert_description
		 FROM certification_requests cr
		 JOIN certifications c ON cr.cert_id = c.id
		 WHERE cr.user_id = ?
		 ORDER BY cr.requested_at DESC`,
		)
		.all(userId);
	res.render("my_certs", {
		user: req.user,
		certs,
		requests,
		active: "my-certs",
	});
});

export default router;
