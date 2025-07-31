import { REST, Routes } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error("DISCORD_TOKEN is not set in the environment variables.");
    process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

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

        let count = 1;
        for (const command of commands) {
            await rest.delete(
                Routes.applicationCommand(process.env.CLIENT_ID, command.id),
            );
            console.log(
                `❌ Deleted /${command.name} (${command.id}) [${count}]`
            );
            count++;
        }

        console.log("✅ All global commands deleted.");
    } catch (error) {
        console.error("Error unregistering commands:", error);
    }
}

unregisterAllCommands();