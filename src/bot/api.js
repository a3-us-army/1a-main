import express from "express";
import { buildEventEmbed } from "../utils/rsvp_embed.js";
import { getDatabase, createApplication } from "./utils/database.js";
import {
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} from "discord.js";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();

let discordClient = null;
export function setDiscordClient(client) {
	discordClient = client;
}

const apiApp = express();
apiApp.use(express.json());

apiApp.post("/api/post-event", async (req, res) => {
	const authHeader = req.headers.authorization;
	const expected = `Bearer ${process.env.BOT_API_SECRET}`;
	if (authHeader !== expected) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const { channelId, event } = req.body;
		if (!channelId || !event) {
			return res.status(400).json({ error: "Missing channelId or event" });
		}
		const channel = await discordClient.channels.fetch(channelId);
		if (!channel || !channel.isTextBased()) {
			return res
				.status(404)
				.json({ error: "Channel not found or not text-based" });
		}

		// --- FIX: Ensure event.time is an integer ---
		event.time = Math.floor(Number(event.time));

		const { embed, components } = buildEventEmbed(event);
		const message = await channel.send({
			content: "<@&1363609382700712129>",
			embeds: [embed],
			components,
		});
		res.json({ messageId: message.id });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Failed to post event" });
	}
});

apiApp.post("/api/post-application", async (req, res) => {
    
	const authHeader = req.headers.authorization;
	const expected = `Bearer ${process.env.BOT_API_SECRET}`;
	if (authHeader !== expected) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const { channelId, application } = req.body;
		if (!channelId || !application) {
			return res
				.status(400)
				.json({ error: "Missing channelId or application" });
		}
		const channel = await discordClient.channels.fetch(channelId);
		if (!channel || !channel.isTextBased()) {
			return res
				.status(404)
				.json({ error: "Channel not found or not text-based" });
		}
		const applicationId = createApplication(application);
		const embed = new EmbedBuilder()
  .setTitle("New Application")
  .setColor(0x3498db)
  .addFields(
    { name: "Applicant", value: `<@${application.userId}> (${application.username || "N/A"})`, inline: false },
    { name: "How did you find the unit?", value: application.foundUnit || "N/A", inline: false },
    { name: "Whats your steam64 ID?", value: application.steam64 || "N/A", inline: false },
    { name: "What name do you want?", value: application.unitName || "N/A", inline: false },
    { name: "How old are you?", value: application.age ? String(application.age) : "N/A", inline: false },
    { name: "List any prior experience?", value: application.experience || "None", inline: false },
    { name: "Whats your desired MOS/AFSC", value: application.mos || "N/A", inline: true },
  )
  .setTimestamp();
		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`app_approve_${applicationId}`)
				.setLabel("Approve")
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(`app_deny_${applicationId}`)
				.setLabel("Deny")
				.setStyle(ButtonStyle.Danger),
		);
		const message = await channel.send({
			content: "<@&1363618702733344768>",
			embeds: [embed],
			components: [row],
		});
		res.json({ messageId: message.id, applicationId });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Failed to post application" });
	}
});

apiApp.post("/api/post-loa", async (req, res) => {
	const authHeader = req.headers.authorization;
	const expected = `Bearer ${process.env.BOT_API_SECRET}`;
    const channelId = process.env.FORMS_CHANNEL_ID
	if (authHeader !== expected) {
		console.error("LOA POST ERROR: Unauthorized");
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const { channelId, event } = req.body;
		if (!channelId || !event) {
			console.error("LOA POST ERROR: Missing channelId or event", {
				channelId,
				event,
			});
			return res.status(400).json({ error: "Missing channelId or event" });
		}
		const channel = await discordClient.channels.fetch(channelId);
		if (!channel || !channel.isTextBased()) {
			console.error(
				"LOA POST ERROR: Channel not found or not text-based",
				channelId,
			);
			return res
				.status(404)
				.json({ error: "Channel not found or not text-based" });
		}
		const loaId = uuidv4(); // Always generate a new ID here
		const db = getDatabase();
		db.prepare(`
			INSERT INTO loa_requests
			(id, user_id, unit_name, reason, begin_date, return_date, first_line, submitted_at, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
		`).run(
			loaId,
			event.userId,
			event.unitName,
			event.reason,
			event.beginDate,
			event.returnDate,
			event.firstLine,
			new Date().toISOString(),
		);

		const embed = new EmbedBuilder()
			.setTitle("New LOA Request")
			.setColor(0xffc107)
			.addFields(
				{ name: "User", value: `<@${event.userId}>`, inline: true },
				{ name: "Unit Name", value: event.unitName, inline: true },
				{ name: "Reason", value: event.reason, inline: false },
				{ name: "Begin Date", value: event.beginDate, inline: true },
				{ name: "Return Date", value: event.returnDate, inline: true },
				{ name: "First Line", value: event.firstLine, inline: true },
			)
			.setTimestamp();

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`loa_approve_${loaId}`)
				.setLabel("Approve")
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(`loa_deny_${loaId}`)
				.setLabel("Deny")
				.setStyle(ButtonStyle.Danger),
		);

		const message = await channel.send({
			content: "<@&1363626257887264808>",
			embeds: [embed],
			components: [row],
		});
		console.log("LOA posted to Discord, message ID:", message.id);
		res.json({ messageId: message.id, loaId });
	} catch (err) {
		console.error("LOA POST ERROR (bot API):", err);
		res
			.status(500)
			.json({ error: "Failed to post event", details: err.message });
	}
});

apiApp.get("/api/channels", async (req, res) => {
	const authHeader = req.headers.authorization;
	const expected = `Bearer ${process.env.BOT_API_SECRET}`;
	if (authHeader !== expected) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const guild = await discordClient.guilds.fetch(process.env.GUILD_ID);
		const fullGuild = await guild.fetch();
		const channels = await fullGuild.channels.fetch();
		const categories = [];
		const textChannels = [];
		for (const [, channel] of channels) {
			if (channel.type === 4) {
				categories.push({ id: channel.id, name: channel.name });
			} else if (channel.type === 0) {
				textChannels.push({
					id: channel.id,
					name: channel.name,
					parentId: channel.parentId,
				});
			}
		}
		res.json({ categories, textChannels });
	} catch (err) {
		console.error("Failed to fetch channels:", err);
		res.status(500).json({ error: "Failed to fetch channels" });
	}
});

apiApp.post("/api/delete-message", async (req, res) => {
	const authHeader = req.headers.authorization;
	const expected = `Bearer ${process.env.BOT_API_SECRET}`;
	if (authHeader !== expected) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	const { channelId, messageId } = req.body;
	if (!channelId || !messageId) {
		return res.status(400).json({ error: "Missing channelId or messageId" });
	}
	try {
		const channel = await discordClient.channels.fetch(channelId);
		if (!channel || !channel.isTextBased()) {
			return res
				.status(404)
				.json({ error: "Channel not found or not text-based" });
		}
		const message = await channel.messages.fetch(messageId);
		await message.delete();
		res.json({ success: true });
	} catch (err) {
		console.error("Failed to delete message:", err);
		res.status(500).json({ error: "Failed to delete message" });
	}
});

apiApp.post("/api/request-cert", async (req, res) => {
	const authHeader = req.headers.authorization;
	const expected = `Bearer ${process.env.BOT_API_SECRET}`;
	if (authHeader !== expected) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const { userId, cert, requestId } = req.body;
		const channelId = process.env.FORMS_CHANNEL_ID;
		if (!userId || !cert || !channelId) {
			return res.status(400).json({ error: "Missing data" });
		}
		const channel = await discordClient.channels.fetch(channelId);
		if (!channel?.isTextBased()) {
			return res.status(404).json({ error: "Channel not found" });
		}
		const embed = new EmbedBuilder()
			.setTitle("Certification Request")
			.setDescription(`User: <@${userId}>`)
			.addFields(
				{ name: "Certification", value: cert.name, inline: true },
				{
					name: "Description",
					value: cert.description || "No description",
					inline: false,
				},
				{
					name: "Requested At",
					value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
					inline: true,
				},
				{ name: "Request ID", value: requestId, inline: true },
			)
			.setColor(0xffa500);
		const approveBtn = new ButtonBuilder()
			.setCustomId(`cert_approve_${requestId}`)
			.setLabel("Approve")
			.setStyle(ButtonStyle.Success);
		const denyBtn = new ButtonBuilder()
			.setCustomId(`cert_deny_${requestId}`)
			.setLabel("Deny")
			.setStyle(ButtonStyle.Danger);
		const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
		await channel.send({ embeds: [embed], components: [row] });
		res.json({ success: true });
	} catch (err) {
		console.error("Error posting cert request to Discord:", err);
		res.status(500).json({ error: "Failed to post to Discord" });
	}
});

apiApp.post("/api/post-equipment", async (req, res) => {
	const authHeader = req.headers.authorization;
	const expected = `Bearer ${process.env.BOT_API_SECRET}`;
	if (authHeader !== expected) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	try {
		const { userId, username, equipment, event, quantity, requestId } =
			req.body;
		const channelId = process.env.FORMS_CHANNEL_ID;
		if (
			!userId ||
			!equipment ||
			!event ||
			!quantity ||
			!channelId ||
			!requestId
		) {
			return res.status(400).json({ error: "Missing data" });
		}
		const channel = await discordClient.channels.fetch(channelId);
		if (!channel?.isTextBased()) {
			return res.status(404).json({ error: "Channel not found" });
		}
		const embed = new EmbedBuilder()
			.setTitle("Equipment Request")
			.setDescription(`User: <@${userId}> (${username || userId})`)
			.addFields(
				{ name: "Equipment", value: equipment.name, inline: true },
				{ name: "Quantity", value: String(quantity), inline: true },
				{ name: "Event", value: event.title, inline: false },
				{
					name: "Event Date",
					value: event.time ? `<t:${Math.floor(Number(event.time))}:F>` : "N/A",
					inline: true,
				},
				{
					name: "Requested At",
					value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
					inline: true,
				},
				{ name: "Request ID", value: requestId, inline: false },
			)
			.setColor(0x1e90ff);
		const approveBtn = new ButtonBuilder()
			.setCustomId(`app_eq_${requestId}`)
			.setLabel("Approve")
			.setStyle(ButtonStyle.Success);
		const denyBtn = new ButtonBuilder()
			.setCustomId(`den_eq_${requestId}`)
			.setLabel("Deny")
			.setStyle(ButtonStyle.Danger);
		const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
		await channel.send({ embeds: [embed], components: [row] });
		res.json({ success: true });
	} catch (err) {
		console.error("Error posting equipment request to Discord:", err);
		res.status(500).json({ error: "Failed to post to Discord" });
	}
});
export default apiApp;
