/**
 * Logger utility for sending logs to a Discord channel
 */

import { EmbedBuilder } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "node:os";
import { formatDistanceToNow } from "date-fns"; // You'll need to install this: npm install date-fns

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config from a JSON file
function loadConfig() {
	try {
		const configPath = path.join(__dirname, "../config/config.json");
		const configData = fs.readFileSync(configPath, "utf8");
		return JSON.parse(configData);
	} catch (error) {
		console.error("Error loading logger config:", error);
		return { logChannelId: null };
	}
}

// Format bytes to a human-readable format
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

// Format seconds to a human-readable time
function formatUptime(seconds) {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	const parts = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

	return parts.join(" ");
}

// Get package version from package.json
function getPackageVersion() {
	try {
		const packagePath = path.join(__dirname, "../../../package.json");
		const packageData = fs.readFileSync(packagePath, "utf8");
		const packageJson = JSON.parse(packageData);
		return packageJson.version || "Unknown";
	} catch (error) {
		console.error("Error reading package.json:", error);
		return "Unknown";
	}

	
}


/**
 * Sends a startup log message to the configured Discord channel
 * @param {Client} client - The Discord.js client
 */
export async function sendStartupLog(client) {
	const config = loadConfig();
	const logChannelId = config.logChannelId;

	if (!logChannelId) {
		console.warn("No log channel ID configured. Skipping startup log.");
		return;
	}

	try {
		// Wait for client to be ready
		if (!client.isReady()) {
			await new Promise((resolve) => {
				client.once("ready", resolve);
			});
		}

		const logChannel = await client.channels.fetch(logChannelId);

		if (!logChannel) {
			console.error(`Log channel with ID ${logChannelId} not found.`);
			return;
		}

		// Get system information
		const hostname = os.hostname();
		const platform = `${os.platform()} (${os.type()} ${os.release()})`;
		const uptime = Math.floor(process.uptime());
		const memoryUsage = process.memoryUsage();
		const nodeVersion = process.version;
		const startTime = new Date(Date.now() - uptime * 1000);
		const version = getPackageVersion();

		// Count users across all guilds
		let totalUsers = 0;
		// biome-ignore lint/complexity/noForEach: <explanation>
		client.guilds.cache.forEach((guild) => {
			totalUsers += guild.memberCount;
		});

		// Create an embed for the startup log
		const embed = new EmbedBuilder()
			.setColor(0x3498db) // A nice blue color
			.setTitle(`🚀 ${client.user.username} is Online!`)
			.setDescription(
				`Bot successfully started at <t:${Math.floor(startTime.getTime() / 1000)}:F>`,
			)
			.setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
			.addFields(
				{
					name: "📊 System Stats",
					value: [
						`**OS**: ${platform}`,
						`**Node.js**: ${nodeVersion}`,
						`**Memory**: ${formatBytes(memoryUsage.rss)} (RSS)`,
						`**Uptime**: ${formatUptime(uptime)}`,
						`**Host**: ${hostname}`,
					].join("\n\n"),
					inline: true,
				},
				{
					name: "🤖 Bot Stats",
					value: [
						`**Version**: ${version}`,
						`**Servers**: ${client.guilds.cache.size.toLocaleString()}`,
						`**Users**: ${totalUsers.toLocaleString()}`,
						`**Channels**: ${client.channels.cache.size.toLocaleString()}`,
					].join("\n\n"),
					inline: true,
				},
			)
			.setTimestamp()
			.setFooter({
				text: `Bot ID: ${client.user.id}`,
				iconURL: client.user.displayAvatarURL({ dynamic: true }),
			});

		// Send the embed to the log channel
		await logChannel.send({ embeds: [embed] });
		console.log(`Startup log sent to channel ${logChannelId}`);
	} catch (error) {
		console.error("Error sending startup log:", error);
	}
}

/**
 * Sends an error log message to the configured Discord channel
 * @param {Client} client - The Discord.js client
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context about the error
 */
export async function sendErrorLog(client, error, context = {}) {
	const config = loadConfig();
	const logChannelId = config.logChannelId;

	if (!logChannelId || !client.isReady()) {
		console.warn(
			"Cannot send error log: Client not ready or no log channel configured",
		);
		return;
	}

	try {
		const logChannel = await client.channels.fetch(logChannelId);

		if (!logChannel) {
			console.error(`Log channel with ID ${logChannelId} not found.`);
			return;
		}

		// Get the error stack or message
		const errorText = error.stack || error.message || String(error);
		// Truncate if too long
		const truncatedError =
			errorText.length > 4000
				? `${errorText.substring(0, 4000)}... (truncated)`
				: errorText;

		const embed = new EmbedBuilder()
			.setColor(0xe74c3c) // Red color for errors
			.setTitle("⚠️ Error Occurred")
			.setDescription(`\`\`\`${truncatedError}\`\`\``)
			.setTimestamp();

		// Add context fields if provided
		if (Object.keys(context).length > 0) {
			const contextFields = Object.entries(context).map(([key, value]) => ({
				name: `📌 ${key}`,
				value: String(value).substring(0, 1024) || "undefined",
				inline: false,
			}));

			embed.addFields(contextFields);
		}

		embed.setFooter({
			text: `Occurred at ${new Date().toISOString()}`,
			iconURL: client.user.displayAvatarURL({ dynamic: true }),
		});

		await logChannel.send({ embeds: [embed] });
	} catch (logError) {
		console.error("Error sending error log:", logError);
	}
}

/**
 * Sends a command usage log to the configured Discord channel
 * @param {Client} client - The Discord.js client
 * @param {Interaction} interaction - The command interaction
 */
export async function logCommand(client, interaction) {
	const config = loadConfig();
	const logChannelId = config.logChannelId;

	if (!logChannelId || !client.isReady()) return;

	try {
		const logChannel = await client.channels.fetch(logChannelId);

		if (!logChannel) return;

		const commandName = interaction.commandName;
		const user = interaction.user;
		const guild = interaction.guild;
		const channel = interaction.channel;

		// Get command options
		const options = [];
		if (interaction.options) {
			for (const option of interaction.options.data) {
				options.push(`${option.name}: ${option.value}`);
			}
		}

		const embed = new EmbedBuilder()
			.setColor(0x9b59b6) // Purple for commands
			.setTitle("🔧 Command Used")
			.addFields(
				{ name: "Command", value: `/${commandName}`, inline: true },
				{ name: "User", value: `${user.tag} (${user.id})`, inline: true },
				{
					name: "Server",
					value: guild ? `${guild.name} (${guild.id})` : "DM",
					inline: true,
				},
				{
					name: "Channel",
					value: channel ? `${channel.name} (${channel.id})` : "Unknown",
					inline: true,
				},
			)
			.setThumbnail(user.displayAvatarURL({ dynamic: true }))
			.setTimestamp();

		if (options.length > 0) {
			embed.addFields({
				name: "Options",
				value: options.join("\n") || "None",
				inline: false,
			});
		}

		await logChannel.send({ embeds: [embed] });
	} catch (error) {
		console.error("Error logging command:", error);
	}
}
