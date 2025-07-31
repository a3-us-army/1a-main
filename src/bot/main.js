import client from './bot.js';
import apiApp, { setDiscordClient } from './api.js';
import dotenv from 'dotenv';
dotenv.config();

const BOT_API_PORT = process.env.BOT_API_PORT || 3001;

client.login(process.env.DISCORD_TOKEN);

client.once('ready', () => {
  setDiscordClient(client);
  apiApp.listen(BOT_API_PORT, () => {
    console.log(`Bot REST API running on port ${BOT_API_PORT}`);
  });
});
