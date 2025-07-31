import { Router } from "express";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

const router = Router();

router.get("/", (req, res) => {
  res.render("appeal", {
    user: req.user,
    active: "appeal",
    query: req.query,
  });
});

router.post("/", async (req, res) => {
  const { username, user_id, reason, details } = req.body;

  if (!username || !user_id || !reason) {
    return res.redirect("/?error=All required fields must be filled out.");
  }

  try {
    const response = await fetch(
      process.env.BOT_API_URL.replace(
        /\/api\/post-event$/,
        "/api/post-appeal"
      ),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
        },
        body: JSON.stringify({
          channelId: process.env.FORMS_CHANNEL_ID,
          appeal: {
            userId: user_id,
            username,
            reason,
            details,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Discord API error:", response.status, text);
      throw new Error("Failed to post appeal to Discord");
    }

    res.redirect("/appeal?alert=Your appeal has been submitted! Staff will review it soon. Make sure to join our appeal Discord above for updates.");
  } catch (err) {
    console.error(err);
    res.redirect("/appeal?error=Failed to submit appeal. Please try again.");
  }
});

export default router;