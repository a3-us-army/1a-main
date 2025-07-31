import { REST, Routes } from "discord.js";

/**
 * Fetch a user's avatar hash from Discord's API.
 * @param {string} userId - The Discord user ID.
 * @param {string} botToken - Your bot's token.
 * @returns {Promise<string|null>} The avatar hash, or null if not found.
 */
export default async function fetchDiscordAvatar(userId, botToken) {
  if (!userId || !botToken) return null;
  try {
    const rest = new REST({ version: "10" }).setToken(botToken);
    const user = await rest.get(Routes.user(userId));
    // user.avatar is a hash, user.id is the ID
    if (user && user.avatar) {
      // Return just the hash (for storing in DB), or the full URL if you prefer
      return user.avatar;
      // Or, to return the full URL:
      // return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }
    return null;
  } catch (e) {
    console.error("Error fetching Discord avatar:", e);
    return null;
  }
}