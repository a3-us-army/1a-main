/**
 * @typedef {import('moonlink.js').Manager} MoonManager
 * @typedef {import('discord.js').Client & { moon: MoonManager }} MoonClient
 */

/** @type {MoonClient} */
import client from './bot.js';
import apiApp, { setDiscordClient } from './api.js';
import dotenv from 'dotenv';
import musicHandler from './handlers/musicHandler.js';

dotenv.config();

const BOT_API_PORT = process.env.BOT_API_PORT || 3001;

client.login(process.env.DISCORD_TOKEN);

musicHandler();

//Just for Debug, Remove Later --Fried
client.moon.on("nodeCreate", node => {
  console.log(`${node.host} was connected, and the magic is in the air`);
});

//Update Packets --Fried
client.on("raw", data => {
  client.moon.packetUpdate(data);
});

client.once('ready', () => {
  setDiscordClient(client);
  client.moon.init(client.user.id); //Initialize Moonlink --Fried
  apiApp.listen(BOT_API_PORT, () => {
    console.log(`Bot REST API running on port ${BOT_API_PORT}`);
  });
});
