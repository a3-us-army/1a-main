import { Router } from "express";
import ensureAdmin from "../middleware/ensureAdmin.js";
import fetch from "node-fetch";
const router = Router();

router.get("/", ensureAdmin, (req, res) => {
  res.render("botstatus", {
    user: req.user,
    active: "botstatus",
    isAdmin: true,
  });
});

// Proxy for bot status (never exposes secret to browser)
router.get("/api", ensureAdmin, async (req, res) => {
  try {
    const resp = await fetch("http://localhost:3001/api/bot-status", {
      headers: { Authorization: `Bearer ${process.env.BOT_STATUS_SECRET}` }
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch bot status" });
  }
});

// Proxy for bot restart
router.post("/api/restart", ensureAdmin, async (req, res) => {
  try {
    const resp = await fetch("http://localhost:3001/api/bot-restart", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.BOT_STATUS_SECRET}` }
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to restart bot" });
  }
});

export default router;