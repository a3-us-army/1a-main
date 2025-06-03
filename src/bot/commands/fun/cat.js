import { SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";

export const data = new SlashCommandBuilder()
	.setName("cat")
	.setDescription("Get a random cat picture!");

export async function execute(interaction) {
	const res = await fetch("https://api.thecatapi.com/v1/images/search");
	const data = await res.json();
	await interaction.reply({ content: "🐱", files: [data[0].url] });
}