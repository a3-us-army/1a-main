import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import {
	setupDatabase,
	resetInventoryForEndedEvents,
} from "./utils/database.js";
import { registerCommands } from "./utils/commandRegistration.js";
import { setupStatusRotation } from "./utils/statusRotation.js";
import { setupReminderSystem } from "./utils/reminderSystem.js";
import { sendStartupLog } from "./utils/logger.js";
import { setupFullLogger } from "./utils/discord_logs.js";
import { handleButtonInteraction } from "./handlers/buttonHandler.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildBans,
		GatewayIntentBits.GuildEmojisAndStickers,
		GatewayIntentBits.GuildIntegrations,
		GatewayIntentBits.GuildWebhooks,
		GatewayIntentBits.GuildInvites,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.GuildScheduledEvents,
		GatewayIntentBits.GuildMessageTyping,
		GatewayIntentBits.GuildModeration,
	],
	partials: [
		Partials.Message,
		Partials.Channel,
		Partials.Reaction,
		Partials.User,
		Partials.GuildMember,
	],
});

setupFullLogger(client);

client.once("ready", async () => {
	console.log(`✅ Logged in as ${client.user.tag}`);

	// Initialize and attach the database
	client.db = setupDatabase();
	console.log("🗄️  Database initialized and attached to client");

	// Register slash commands if needed
	if (process.env.REGISTER_COMMANDS === "true") {
		console.log("⚙️  Registering commands...");
		await registerCommands();
		console.log("✅ Commands registered successfully!");
	} else {
		console.log("⏭️  Skipping command registration on startup");
	}

	// Setup status rotation and reminders
	setupStatusRotation(client);
	setupReminderSystem(client);

	// Send startup log to Discord channel
	await sendStartupLog(client);

	// Periodically reset inventory for ended events
	setInterval(
		() => {
			console.log("🔄 Checking for ended events and resetting inventory...");
			resetInventoryForEndedEvents();
		},
		5 * 60 * 1000,
	);
});

// --- Message event for eval command (if you use it) ---
client.on("messageCreate", async (message) => {
	if (message.author.bot) return;
	const mentionPrefix = `<@${client.user.id}>`;
	if (!message.content.startsWith(mentionPrefix)) return;
	const content = message.content.slice(mentionPrefix.length).trim();
	if (content.startsWith("eval")) {
		try {
			const { handleEval } = await import(
				"../commands/text-commands/textEval.js"
			);
			await handleEval(message, content.slice(4).trim(), client);
		} catch (error) {
			console.error("Error handling eval command:", error);
			await message.reply(
				"An error occurred while processing the eval command.",
			);
		}
	}
});

// --- Interaction handling (slash, buttons, modals, etc) ---
client.on("interactionCreate", async (interaction) => {
	// Slash commands
	if (interaction.isCommand()) {
		const { commandName } = interaction;
		try {
			const commandsDir = path.join(__dirname, "commands");
			const filePath = findCommandFile(commandsDir, commandName);
			if (!filePath)
				throw new Error(`Command file for "${commandName}" not found.`);
			const commandModule = await import(pathToFileURL(filePath).href);
			await commandModule.execute(interaction, client);
		} catch (error) {
			console.error(`Error executing command ${commandName}:`, error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({
					content: "There was an error executing this command.",
					ephemeral: true,
				});
			}
		}
	}

	// Autocomplete
	if (interaction.isAutocomplete()) {
		const { commandName } = interaction;
		try {
			const commandsDir = path.join(__dirname, "commands");
			const filePath = findCommandFile(commandsDir, commandName);
			if (!filePath)
				throw new Error(`Command file for "${commandName}" not found.`);
			const commandModule = await import(pathToFileURL(filePath).href);
			if (commandModule.autocomplete) {
				await commandModule.autocomplete(interaction, client);
			}
		} catch (error) {
			console.error(`Error handling autocomplete for ${commandName}:`, error);
		}
	}

	// Modals
	if (interaction.isModalSubmit()) {
		try {
			if (interaction.customId === "create_event_modal") {
				const { handleModalSubmit } = await import(
					"./commands/events/create-event.js"
				);
				await handleModalSubmit(interaction, client);
			} else if (interaction.customId.startsWith("deny_r_")) {
				const { handleModalSubmit } = await import(
					"./commands/equipment/equipment-request.js"
				);
				await handleModalSubmit(interaction);
			} else if (interaction.customId.startsWith("cert_deny_modal_")) {
				const { handleModalSubmit } = await import(
					"./handlers/buttonHandler.js"
				);
				await handleModalSubmit(interaction);
			}
		} catch (error) {
			console.error("Error handling modal submit:", error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({
					content: "There was an error processing your submission.",
					ephemeral: true,
				});
			}
		}
	}

	// Buttons
	if (interaction.isButton()) {
		try {
			if (
				interaction.customId.startsWith("rsvp_") ||
				interaction.customId.startsWith("delete_event_") ||
				interaction.customId.startsWith("check_equipment_") ||
				interaction.customId.startsWith("cert_approve_") ||
				interaction.customId.startsWith("cert_deny_")
			) {
				await handleButtonInteraction(interaction, client);
			} else if (
				interaction.customId.startsWith("app_eq_") ||
				interaction.customId.startsWith("den_eq_")
			) {
				const { handleButtonInteraction } = await import(
					"./commands/equipment/equipment-request.js"
				);
				await handleButtonInteraction(interaction);
			} else if (
				interaction.customId.startsWith("loa_approve_") ||
				interaction.customId.startsWith("loa_deny_")
			) {
				const { handleLOAButton } = await import(
					"./handlers/loaButtonHandler.js"
				);
				await handleLOAButton(interaction);
			} else if (
				interaction.customId.startsWith("app_approve_") ||
				interaction.customId.startsWith("app_deny_")
			) {
				const { handleApplicationButton } = await import(
					"./handlers/applicationButtonHandler.js"
				);
				await handleApplicationButton(interaction);
			}
		} catch (error) {
			console.error("Error handling button interaction:", error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({
					content: "There was an error processing your interaction.",
					ephemeral: true,
				});
			}
		}
	}
});

// --- Helper: recursively find a command file by name ---
function findCommandFile(commandsDir, commandName) {
	const files = fs.readdirSync(commandsDir);
	for (const file of files) {
		const filePath = path.join(commandsDir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			const found = findCommandFile(filePath, commandName);
			if (found) return found;
		} else if (
			stat.isFile() &&
			file.endsWith(".js") &&
			file.replace(/\.js$/, "") === commandName
		) {
			return filePath;
		}
	}
	return null;
}

// --- Error logging ---
process.on("unhandledRejection", (error) => {
	console.error("Unhandled promise rejection:", error);
});
process.on("uncaughtException", (error) => {
	console.error("Uncaught exception:", error);
});

export default client;
