import dotenv from "dotenv";
import { getDatabase } from "./database.js";
import fetch from "node-fetch";

dotenv.config();

const db = getDatabase();

async function updateAllDiscordAvatars() {
	const personnel = db
		.prepare(
			"SELECT id, discord_id FROM personnel WHERE discord_id IS NOT NULL",
		)
		.all();

	for (const person of personnel) {
		try {
			const res = await fetch(
				`https://discord.com/api/v10/users/${person.discord_id}`,
				{
					headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
				},
			);
			if (!res.ok) {
				console.error(
					`Failed to fetch user ${person.discord_id}: ${res.status}`,
				);
				continue;
			}
			const user = await res.json();
			if (user.avatar) {
				db.prepare("UPDATE personnel SET discord_avatar = ? WHERE id = ?").run(
					user.avatar,
					person.id,
				);
				console.log(`Updated avatar for ${person.discord_id}`);
			} else {
				console.log(`No avatar for ${person.discord_id}`);
			}
		} catch (e) {
			console.error(`Error updating avatar for ${person.discord_id}:`, e);
		}
	}
	console.log("All avatars updated!");
}

updateAllDiscordAvatars();
