import { SlashCommandBuilder } from "discord.js";

const insults = [
	"You're as sharp as a bowling ball.",
	"I'd agree with you, but then we'd both be wrong.",
	"You're not stupid; you just have bad luck thinking.",
	"If laughter is the best medicine, your face must be curing the world.",
	"You're proof that evolution can go in reverse.",
];

export const data = new SlashCommandBuilder()
	.setName("insult")
	.setDescription("Send a random (mild) insult.")
	.addUserOption((opt) =>
		opt.setName("user").setDescription("User to insult").setRequired(true),
	);

export async function execute(interaction) {
	const user = interaction.options.getUser("user");
	const insult = insults[Math.floor(Math.random() * insults.length)];
	await interaction.reply(`😈 ${user}, ${insult}`);
}