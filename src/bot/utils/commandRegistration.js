import { SlashCommandBuilder, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

dotenv.config();

const USE_GUILD_COMMANDS = false; // <--- Set to true for per-guild, false for global (TEMPORARY FOR TESTING)
const GUILD_ID = process.env.GUILD_ID; // Set in your .env

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getAllCommandFiles(dir, fileList = [], relPath = '') {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.startsWith('_')) {
        getAllCommandFiles(filePath, fileList, path.join(relPath, file));
      } else {
        console.log(
          `ℹ️ Skipping disabled directory: ${path.join(relPath, file)}`
        );
      }
    } else if (
      stat.isFile() &&
      file.endsWith('.js') &&
      !filePath.includes(`${path.sep}text-commands${path.sep}`)
    ) {
      fileList.push({
        filePath,
        category: relPath ? capitalize(relPath.split(path.sep)[0]) : 'General',
      });
    }
  }
  return fileList;
}

export async function getAllCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, '../commands');

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
            `✅ Registered command: /${commandData.name}${category ? ` (category: ${category})` : ''}`
          );

          if (commandData.options?.some(opt => opt.autocomplete)) {
            console.log('   - Command has autocomplete options');
          }
        } else {
          const defaultName = path
            .basename(filePath, '.js')
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase();

          const commandData = new SlashCommandBuilder()
            .setName(defaultName)
            .setDescription(`${defaultName} command`)
            .toJSON();

          if (category) commandData.category = category;
          commands.push(commandData);

          console.log(
            `⚠️ Using default configuration for command: /${defaultName}${category ? ` (category: ${category})` : ''}`
          );
        }
      } catch (error) {
        console.error(`❌ Error loading command from file ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Error reading commands directory:', error);
  }

  return commands;
}

export async function registerCommands() {
  const commands = await getAllCommands();

  const rest = new REST({
    version: '10',
    timeout: 300000, // 5 min
  }).setToken(process.env.DISCORD_TOKEN);

  try {
    let registrationPromise;
    let targetDescription;

    if (USE_GUILD_COMMANDS) {
      if (!GUILD_ID) throw new Error('GUILD_ID is not set in .env!');
      targetDescription = `guild ${GUILD_ID}`;
      console.log(
        `🚀 Registering ${commands.length} commands to guild ${GUILD_ID}...`
      );
      registrationPromise = rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
        { body: commands }
      );
    } else {
      targetDescription = 'globally';
      console.log(`🚀 Registering ${commands.length} commands globally...`);
      registrationPromise = rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
    }

    console.log(`⏱️ Starting registration at ${new Date().toISOString()}`);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Registration timeout after 30 seconds'));
      }, 30000);
    });

    const data = await Promise.race([registrationPromise, timeoutPromise]);

    console.log(`✅ Registration completed at ${new Date().toISOString()}`);

    const manifest = data.map(cmd => {
      const local = commands.find(c => c.name === cmd.name);
      return {
        ...cmd,
        category: local?.category || 'General',
      };
    });

    const manifestPath = path.join(process.cwd(), 'commands-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Wrote command manifest to ${manifestPath}`);

    console.log(
      `✅ Successfully registered ${data.length} slash commands ${targetDescription}:`
    );
    for (const cmd of manifest) {
      console.log(
        `   - /${cmd.name}${cmd.category ? ` (category: ${cmd.category})` : ''}`
      );
    }

    return data;
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);

    if (error.message?.includes('timeout')) {
      console.error('⏰ REGISTRATION TIMEOUT - Process took too long');
      console.error('   This could be due to:');
      console.error('   - Discord API being slow/unresponsive');
      console.error('   - Network connectivity issues');
      console.error('   - Too many commands being registered at once');
      console.error('   - Rate limiting (even if not explicitly returned)');
    }

    if (error.code === 429) {
      console.error('🚨 RATE LIMITED - Discord API rate limit exceeded');
      console.error(
        `   Retry after: ${error.retry_after || 'unknown'} seconds`
      );
      console.error(`   Rate limit bucket: ${error.bucket || 'unknown'}`);
      console.error(`   Global rate limit: ${error.global || false}`);

      if (error.retry_after) {
        console.error(
          `   ⏰ Wait ${error.retry_after} seconds before retrying`
        );
      }
    } else if (error.code === 401) {
      console.error('🔐 UNAUTHORIZED - Invalid Discord token');
      console.error('   Check your DISCORD_TOKEN environment variable');
    } else if (error.code === 403) {
      console.error('🚫 FORBIDDEN - Bot lacks required permissions');
      console.error("   Ensure the bot has 'applications.commands' scope");
    } else if (error.code === 400) {
      console.error('📝 BAD REQUEST - Invalid command data');
      console.error('   Check command structure and options');
      if (error.errors) {
        console.error(
          '   Validation errors:',
          JSON.stringify(error.errors, null, 2)
        );
      }
    } else if (error.code === 500) {
      console.error('🔧 INTERNAL SERVER ERROR - Discord API issue');
      console.error('   This is a Discord-side problem, try again later');
    } else if (error.code === 503) {
      console.error('🛠️ SERVICE UNAVAILABLE - Discord API maintenance');
      console.error('   Discord services are temporarily unavailable');
    } else if (error.message?.includes('ENOTFOUND')) {
      console.error('🌐 NETWORK ERROR - Cannot reach Discord API');
      console.error('   Check your internet connection');
    } else if (error.message?.includes('ECONNRESET')) {
      console.error('🔌 CONNECTION RESET - Network connection lost');
      console.error('   Network instability, try again');
    } else if (error.message?.includes('ETIMEDOUT')) {
      console.error('⏰ TIMEOUT - Request timed out');
      console.error('   Network is slow or Discord API is overloaded');
    }

    console.error('📋 Error Details:');
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error(`   Message: ${error.message || 'N/A'}`);
    console.error(`   Status: ${error.status || 'N/A'}`);
    console.error(`   Method: ${error.method || 'N/A'}`);
    console.error(`   URL: ${error.url || 'N/A'}`);

    console.error('📤 Request Details:');
    console.error(`   Commands count: ${commands.length}`);
    console.error(`   Client ID: ${process.env.CLIENT_ID || 'NOT SET'}`);
    console.error(
      `   Token length: ${process.env.DISCORD_TOKEN?.length || 0} characters`
    );

    console.error('💡 Suggested Solutions:');
    if (error.message?.includes('timeout')) {
      console.error('   - Try registering commands in smaller batches');
      console.error('   - Check Discord API status');
      console.error('   - Consider registering per guild instead of globally');
      console.error('   - Increase timeout if needed');
    } else if (error.code === 429) {
      console.error('   - Implement exponential backoff retry logic');
      console.error('   - Reduce command registration frequency');
      console.error(
        '   - Consider registering commands per guild instead of globally'
      );
    } else if (error.code === 401) {
      console.error('   - Verify DISCORD_TOKEN in your .env file');
      console.error("   - Ensure token hasn't expired");
      console.error('   - Check if bot was deleted/recreated');
    } else if (error.code === 403) {
      console.error("   - Add 'applications.commands' scope to bot invite");
      console.error('   - Ensure bot has proper permissions');
    }

    throw error;
  }
}
