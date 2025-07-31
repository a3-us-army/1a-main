import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error('DISCORD_TOKEN is not set in the environment variables.');
  process.exit(1);
}

if (!guildId) {
  console.error('GUILD_ID is not set in the environment variables.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function unregisterAllCommands() {
  try {
    console.log('Fetching all guild commands...');
    const commands = await rest.get(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId)
    );

    if (!commands.length) {
      console.log('No guild commands to delete.');
      return;
    }

    console.log(`Found ${commands.length} guild commands. Deleting...`);

    let count = 1;
    for (const command of commands) {
      await rest.delete(
        Routes.applicationGuildCommand(
          process.env.CLIENT_ID,
          guildId,
          command.id
        )
      );
      console.log(`❌ Deleted /${command.name} (${command.id}) [${count}]`);
      count++;
    }

    console.log('✅ All guild commands deleted.');
  } catch (error) {
    console.error('Error unregistering commands:', error);
  }
}

unregisterAllCommands();
