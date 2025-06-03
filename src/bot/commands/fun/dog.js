import { SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";

export const data = new SlashCommandBuilder()
	.setName("dog")
	.setDescription("Get a random dog picture!");

export async function execute(interaction) {
	const res = await fetch("https://dog.ceo/api/breeds/image/random");
	const data = await res.json();
	await interaction.reply({ content: "🐶", files: [data.message] });
}