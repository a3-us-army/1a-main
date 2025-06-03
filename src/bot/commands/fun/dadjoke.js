import { SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";

export const data = new SlashCommandBuilder()
	.setName("dadjoke")
	.setDescription("Get a random dad joke!");

export async function execute(interaction) {
	const res = await fetch("https://icanhazdadjoke.com/", {
		headers: { Accept: "application/json" },
	});
	const data = await res.json();
	await interaction.reply(`🤣 ${data.joke}`);
}