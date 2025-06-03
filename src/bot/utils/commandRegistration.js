import { SlashCommandBuilder, REST, Routes } from "discord.js";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Capitalize the first letter of a string
function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

// Recursively get all .js files in a directory and its subdirectories, excluding text-commands
function getAllCommandFiles(dir, fileList = [], relPath = "") {
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory() && file !== "text-commands") {
			getAllCommandFiles(filePath, fileList, path.join(relPath, file));
		} else if (
			stat.isFile() &&
			file.endsWith(".js") &&
			!filePath.includes(`${path.sep}text-commands${path.sep}`) &&
			!filePath.endsWith(`${path.sep}text-commands${path.sep}${file}`)
		) {
			fileList.push({
				filePath,
				category: relPath ? capitalize(relPath.split(path.sep)[0]) : "General",
			});
		}
	}
	return fileList;
}

export async function getAllCommands() {
	const commands = [];
	const commandsPath = path.join(__dirname, "../commands");

	try {
		const commandFiles = getAllCommandFiles(commandsPath);

		console.log(`Found ${commandFiles.length} command files to process...`);

		for (const { filePath, category } of commandFiles) {
			try {
				const fileUrl = pathToFileURL(filePath).href;
				const commandModule = await import(fileUrl);

				if (commandModule.data) {
					const commandData = commandModule.data.toJSON();
					if (category) commandData.category = category;
					commands.push(commandData);
					console.log(
						`✅ Registered command: /${commandData.name}${category ? ` (category: ${category})` : ""}`,
					);

					if (commandData.options?.some((opt) => opt.autocomplete)) {
						console.log("   - Command has autocomplete options");
					}
				} else {
					const defaultName = path
						.basename(filePath, ".js")
						.replace(/([A-Z])/g, "-$1")
						.toLowerCase();
					const commandData = new SlashCommandBuilder()
						.setName(defaultName)
						.setDescription(`${defaultName} command`)
						.toJSON();
					if (category) commandData.category = category;
					commands.push(commandData);
					console.log(
						`⚠️ Using default configuration for command: /${defaultName}${category ? ` (category: ${category})` : ""}`,
					);
				}
			} catch (error) {
				console.error(`❌ Error loading command from file ${filePath}:`, error);
			}
		}
	} catch (error) {
		console.error("❌ Error reading commands directory:", error);
	}

	return commands;
}

// Register all commands with Discord API and write manifest with IDs and categories
export async function registerCommands() {
	const commands = await getAllCommands();

	const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

	try {
		console.log(
			`🚀 Starting to register ${commands.length} slash commands with Discord API...`,
		);

		// Register and get the actual Discord command objects (with IDs)
		const data = await rest.put(
			Routes.applicationCommands(process.env.CLIENT_ID),
			{ body: commands },
		);

		// Merge category from local commands into Discord-returned data
		const manifest = data.map((cmd) => {
			const local = commands.find((c) => c.name === cmd.name);
			return {
				...cmd,
				category: local?.category ? local.category : "General",
			};
		});

		// Write the manifest with categories
		const manifestPath = path.join(process.cwd(), "commands-manifest.json");
		fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
		console.log(`✅ Wrote command manifest to ${manifestPath}`);

		console.log(`✅ Successfully registered ${data.length} slash commands:`);
		for (const cmd of manifest) {
			console.log(
				`   - /${cmd.name}${cmd.category ? ` (category: ${cmd.category})` : ""}`,
			);
		}

		return data;
	} catch (error) {
		console.error("❌ Error registering slash commands:", error);
		throw error;
	}
}