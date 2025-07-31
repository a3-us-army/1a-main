import { Router } from "express";
import ensureAuth from "../middleware/ensureAuth.js";
import ensureAdmin from "../middleware/ensureAdmin.js";
import { getDatabase } from "../../bot/utils/database.js";
import fetch from "node-fetch";
const router = Router();
const db = getDatabase();

import { isUserAdmin } from "../utils/discord.js"; // adjust path as needed

router.get("/", ensureAuth, async (req, res) => {
  const forms = db.prepare("SELECT * FROM custom_forms ORDER BY created_at DESC").all();
  let isAdmin = false;
  if (req.user) {
    isAdmin = await isUserAdmin(req.user.id);
  }
  res.render("forms_list", {
    user: req.user,
    forms,
    active: "forms",
    alert: req.query.alert,
    error: req.query.error,
    isAdmin,
  });
});

// Admin: create form page
router.get("/admin/new", ensureAuth, ensureAdmin, async (req, res) => {
    let roles = [];
    try {
      const resp = await fetch(
        `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/roles`,
        { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
      );
      roles = await resp.json();
    } catch (e) { roles = []; }
    res.render("forms_admin_new", {
      user: req.user,
      roles, // <-- must be passed!
      active: "forms",
      alert: req.query.alert,
    error: req.query.error,
    });
  });

// Admin: handle form creation
router.post("/admin/new", ensureAuth, ensureAdmin, (req, res) => {
  const { title, description, ping_role_id, field_names, field_labels, field_required } = req.body;
  if (!title || !field_names || !field_labels) {
    return res.redirect("/forms/admin/new?error=Missing required fields");
  }
  // Build fields array
  const fields = [];
  for (let i = 0; i < field_names.length; i++) {
    fields.push({
      name: field_names[i],
      label: field_labels[i],
      required: !!field_required?.[i],
    });
  }
  db.prepare(`
    INSERT INTO custom_forms (title, description, fields, ping_role_id, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description,
    JSON.stringify(fields),
    ping_role_id || null,
    req.user.id,
    new Date().toISOString()
  );
  res.redirect("/forms?alert=Form created!");
});

// User: fill out a form
router.get("/:id", ensureAuth, (req, res) => {
  const form = db.prepare("SELECT * FROM custom_forms WHERE id = ?").get(req.params.id);
  if (!form) return res.redirect("/forms?error=Form not found");
  form.fields = JSON.parse(form.fields);
  res.render("forms_fill", { user: req.user, form, active: "forms", alert: req.query.alert,
    error: req.query.error, });
});

// User: submit a form
router.post("/:id", ensureAuth, async (req, res) => {
  const form = db.prepare("SELECT * FROM custom_forms WHERE id = ?").get(req.params.id);
  if (!form) return res.redirect("/forms?error=Form not found");
  const fields = JSON.parse(form.fields);
  // Build submission object
  const submission = {};
  for (const field of fields) {
    submission[field.name] = req.body[field.name] || "";
    if (field.required && !submission[field.name]) {
      return res.redirect(`/forms/${form.id}?error=Missing required field: ${field.label}`);
    }
  }
  // Post to Discord
  try {
    const channelId = process.env.FORMS_CHANNEL_ID;
    const pingRole = form.ping_role_id ? `<@&${form.ping_role_id}>` : "";
    const embed = {
      title: `Form Submission: ${form.title}`,
      description: form.description || "",
      color: 0x3498db,
      fields: fields.map(f => ({
        name: f.label,
        value: submission[f.name] || "—",
        inline: false,
      })),
      footer: { text: `Submitted by ${req.user.username} (${req.user.id})` },
      timestamp: new Date().toISOString(),
    };
    await fetch(process.env.BOT_API_URL.replace(/\/api\/post-event$/, "/api/post-form"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
      },
      body: JSON.stringify({
        channelId,
        embed,
        pingRole,
      }),
    });
    res.redirect("/forms?alert=Form submitted!");
  } catch (e) {
    console.error("Failed to post form to Discord:", e);
    res.redirect(`/forms/${form.id}?error=Failed to post to Discord`);
  }
});

router.get("/admin/edit/:id", ensureAuth, ensureAdmin, (req, res) => {
    const form = db.prepare("SELECT * FROM custom_forms WHERE id = ?").get(req.params.id);
    if (!form) return res.redirect("/forms?error=Form not found");
    form.fields = JSON.parse(form.fields);
    // Fetch roles for the ping dropdown (from Discord API)
    let roles = [];
    fetch(
      `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/roles`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
    )
      .then(resp => resp.json())
      .then(allRoles => {
        res.render("forms_admin_new", {
          user: req.user,
          roles: allRoles,
          active: "forms",
          error: req.query.error,
          form, // Pass the form to pre-fill fields
          editMode: true
        });
      })
      .catch(() => {
        res.render("forms_admin_new", {
          user: req.user,
          roles: [],
          active: "forms",
          error: req.query.error,
          form,
          editMode: true
        });
      });
  });

  router.post("/admin/edit/:id", ensureAuth, ensureAdmin, (req, res) => {
    const { title, description, ping_role_id, field_names, field_labels, field_required } = req.body;
    if (!title || !field_names || !field_labels) {
      return res.redirect(`/forms/admin/edit/${req.params.id}?error=Missing required fields`);
    }
    // Build fields array
    const fields = [];
    for (let i = 0; i < field_names.length; i++) {
      fields.push({
        name: field_names[i],
        label: field_labels[i],
        required: !!field_required?.[i],
      });
    }
    db.prepare(`
      UPDATE custom_forms
      SET title = ?, description = ?, fields = ?, ping_role_id = ?
      WHERE id = ?
    `).run(
      title,
      description,
      JSON.stringify(fields),
      ping_role_id || null,
      req.params.id
    );
    res.redirect("/forms?alert=Form updated!");
  });

  router.post("/admin/delete/:id", ensureAuth, ensureAdmin, (req, res) => {
    db.prepare("DELETE FROM custom_forms WHERE id = ?").run(req.params.id);
    res.redirect("/forms?alert=Form deleted!");
  });

export default router;