import { REST, Routes } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function unregisterAllCommands() {
	try {
		console.log("Fetching all global commands...");
		const commands = await rest.get(
			Routes.applicationCommands(process.env.CLIENT_ID),
		);

		if (!commands.length) {
			console.log("No global commands to delete.");
			return;
		}

		console.log(`Found ${commands.length} global commands. Deleting...`);

		for (const command of commands) {
			await rest.delete(
				Routes.applicationCommand(process.env.CLIENT_ID, command.id),
			);
			console.log(`❌ Deleted /${command.name} (${command.id})`);
		}

		console.log("✅ All global commands deleted.");
	} catch (error) {
		console.error("Error unregistering commands:", error);
	}
}

unregisterAllCommands();
