import { SlashCommandBuilder } from "discord.js";

const compliments = [
	"You're a true friend.",
	"Your creativity is contagious.",
	"You light up the room.",
	"You're a great listener.",
	"Your positivity is infectious.",
	"You have a great sense of humor.",
	"You're a natural leader.",
	"You're really courageous.",
	"Your kindness is a balm to all who encounter it.",
	"You're making a difference.",
];

export const data = new SlashCommandBuilder()
	.setName("compliment")
	.setDescription("Give a user a random compliment.")
	.addUserOption((opt) =>
		opt
			.setName("user")
			.setDescription("Who do you want to compliment?")
			.setRequired(true),
	);

export async function execute(interaction) {
	const user = interaction.options.getUser("user");
	const compliment =
		compliments[Math.floor(Math.random() * compliments.length)];
	await interaction.reply(`💬 ${user}, ${compliment}`);
}