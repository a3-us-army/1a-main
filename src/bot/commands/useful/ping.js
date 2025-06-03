import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("ping")
	.setDescription("Check the bot's response time and status");

export async function execute(interaction) {
	try {
		// Record the time when the command was received
		const startTime = Date.now();

		// Send an initial response
		const initialResponse = await interaction.reply({
			content: "Pinging...",
			fetchReply: true,
		});

		// Calculate the round-trip time
		const endTime = Date.now();
		const ping = endTime - startTime;

		// Get the WebSocket ping
		const wsping = interaction.client.ws.ping;

		// Get uptime
		const uptime = formatUptime(interaction.client.uptime);

		// Determine ping quality indicators and colors
		const { pingQuality, pingColor } = getPingQualityInfo(ping);
		const { pingQuality: wsPingQuality, pingColor: wsPingColor } =
			getPingQualityInfo(wsping);

		// Create a fancy embed
		const embed = new EmbedBuilder()
			.setTitle("Ping Stats")
			.setDescription("Bot status and response times")
			.setColor(getOverallColor(ping, wsping))
			.addFields(
				{
					name: "Bot Latency",
					value: `${pingQuality} **${ping}ms**`,
					inline: true,
				},
				{
					name: "API Latency",
					value: `${wsPingQuality} **${wsping}ms**`,
					inline: true,
				},
				{
					name: "Uptime",
					value: `⏱️ **${uptime}**`,
					inline: true,
				},
			)
			.setFooter({
				text: "Bot is operational!",
				iconURL: interaction.client.user.displayAvatarURL(),
			})
			.setTimestamp();

		// Edit the response with the ping information
		await interaction.editReply({
			content: null,
			embeds: [embed],
		});
	} catch (error) {
		console.error("Error executing ping command:", error);

		// Handle the case where the initial reply failed
		if (!interaction.replied) {
			await interaction.reply({
				content:
					"❌ There was an error checking the ping. The bot might be experiencing issues.",
				ephemeral: true,
			});
		} else {
			await interaction.editReply({
				content:
					"❌ There was an error checking the ping. The bot might be experiencing issues.",
			});
		}
	}
}

/**
 * Determines ping quality indicator and color based on ping value
 * @param {number} ping - The ping value in ms
 * @returns {Object} Object containing emoji and color
 */
function getPingQualityInfo(ping) {
	if (ping < 100) {
		return { pingQuality: "🟢", pingColor: 0x57f287 }; // Green - Excellent
	}
	if (ping < 200) {
		return { pingQuality: "🟡", pingColor: 0xfee75c }; // Yellow - Good
	}
	if (ping < 400) {
		return { pingQuality: "🟠", pingColor: 0xffa500 }; // Orange - Fair
	}
	return { pingQuality: "🔴", pingColor: 0xed4245 }; // Red - Poor
}

/**
 * Determines the overall color for the embed based on both ping values
 * @param {number} ping - The bot latency in ms
 * @param {number} wsping - The API latency in ms
 * @returns {number} The color code
 */
function getOverallColor(ping, wsping) {
	const worstPing = Math.max(ping, wsping);
	return getPingQualityInfo(worstPing).pingColor;
}

/**
 * Formats the uptime into a readable string
 * @param {number} uptime - The uptime in milliseconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(uptime) {
	const totalSeconds = Math.floor(uptime / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const parts = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

	return parts.join(" ");
}
