import { SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";

export const data = new SlashCommandBuilder()
	.setName("fox")
	.setDescription("Get a random fox picture!");

export async function execute(interaction) {
	const res = await fetch("https://randomfox.ca/floof/");
	const data = await res.json();
	await interaction.reply({ content: "🦊", files: [data.image] });
}