import { SlashCommandBuilder } from "discord.js";

const quotes = [
	"Success is not final, failure is not fatal: it is the courage to continue that counts. — Winston Churchill",
	"Do, or do not. There is no try. — Yoda",
	"Keep your face always toward the sunshine—and shadows will fall behind you. — Walt Whitman",
	"Life is what happens when you're busy making other plans. — John Lennon",
	"Never let the fear of striking out keep you from playing the game. — Babe Ruth",
	"To err is human, but to really foul things up you need a computer. — Paul Ehrlich",
	"Why don’t scientists trust atoms? Because they make up everything.",
	"Don’t worry if plan A fails, there are 25 more letters in the alphabet.",
];

export const data = new SlashCommandBuilder()
	.setName("quote")
	.setDescription("Get a random inspirational or funny quote.");

export async function execute(interaction) {
	const quote = quotes[Math.floor(Math.random() * quotes.length)];
	await interaction.reply(`💬 ${quote}`);
}