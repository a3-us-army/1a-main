import { ActivityType, PresenceUpdateStatus } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map ActivityType to a chalk color function
const typeColorMap = {
	[ActivityType.Playing]: chalk.green,
	[ActivityType.Streaming]: chalk.magenta,
	[ActivityType.Listening]: chalk.cyan,
	[ActivityType.Watching]: chalk.yellow,
	[ActivityType.Custom]: chalk.blue,
	[ActivityType.Competing]: chalk.red,
};

// Function to load statuses from JSON file
function loadStatusMessages() {
	try {
		const filePath = path.join(__dirname, "../config/statuses.json");
		const data = fs.readFileSync(filePath, "utf8");
		const statuses = JSON.parse(data);

		return statuses.map((status) => ({
			text: status.text,
			type: status.type,
		}));
	} catch (error) {
		console.error("Error loading status messages:", error);
		return [
			{
				text: "Error Loading Statuses lol",
				type: ActivityType.Custom,
			},
		];
	}
}

let statusMessages = [];
let currentStatusIndex = -1;
let lastStatusType = null;

// Function to update the bot's status
function updateStatus(client) {
	statusMessages = loadStatusMessages();

	let newIndex;
	let tries = 0;
	do {
		newIndex = Math.floor(Math.random() * statusMessages.length);
		tries++;
		// Prevent infinite loop if all statuses are the same type
		if (tries > 10) break;
	} while (
		(newIndex === currentStatusIndex && statusMessages.length > 1) ||
		(statusMessages[newIndex].type === lastStatusType &&
			statusMessages.length > 1)
	);

	currentStatusIndex = newIndex;
	const status = statusMessages[currentStatusIndex];
	lastStatusType = status.type;

	client.user.setPresence({
		activities: [
			{
				name: status.text,
				type: status.type,
			},
		],
		status: PresenceUpdateStatus.DoNotDisturb,
	});

	const colorFn = typeColorMap[status.type] || chalk.white;
	console.log(
		colorFn(`Status updated to: ${ActivityType[status.type]} ${status.text}`),
	);
}

export function setupStatusRotation(client) {
	statusMessages = loadStatusMessages();
	updateStatus(client);
	setInterval(() => updateStatus(client), 15000);
}
