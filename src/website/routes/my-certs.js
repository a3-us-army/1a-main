import { Router } from "express";
import ensureAuth from "../middleware/ensureAuth.js";
import { getDatabase } from "../../bot/utils/database.js";

const router = Router();

router.get("/", ensureAuth, (req, res) => {
	const db = getDatabase();
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
		active: "profile",
	});
});

export default router;
