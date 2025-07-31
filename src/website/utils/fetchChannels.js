import fetch from 'node-fetch';

export default async function fetchDiscordChannels() {
  try {
    const apiUrl = process.env.BOT_API_URL.replace(
      /\/api\/post-event$/,
      '/api/channels'
    );
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BOT_API_SECRET}`,
      },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.error('Failed to fetch channels from bot:', err);
  }
  return [];
}
