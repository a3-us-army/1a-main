import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
	res.render("home", {
		user: req.user,
		active: "home",
	});
});

router.get("/dashboard", (req, res) => {
	res.render("dashboard", {
		user: req.user,
		active: "dashboard",
	});
});

router.get("/about", (req, res) => {
	res.render("about", { user: req.user, active: "about" });
});

router.get("/tos", (req, res) => {
	res.render("tos", { user: req.user, active: "" });
});

router.get("/privacy", (req, res) => {
	res.render("privacy", { user: req.user, active: "" });
});

export default router;