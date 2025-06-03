import { SlashCommandBuilder } from "discord.js";

const responses = [
	"It is certain.",
	"Without a doubt.",
	"You may rely on it.",
	"Yes, definitely.",
	"Most likely.",
	"Outlook good.",
	"Yes.",
	"Signs point to yes.",
	"Reply hazy, try again.",
	"Ask again later.",
	"Cannot predict now.",
	"Don't count on it.",
	"My reply is no.",
	"Outlook not so good.",
	"Very doubtful.",
];

export const data = new SlashCommandBuilder()
	.setName("8ball")
	.setDescription("Ask the magic 8-ball a question.")
	.addStringOption((opt) =>
		opt.setName("question").setDescription("Your question").setRequired(true),
	);

export async function execute(interaction) {
	const question = interaction.options.getString("question");
	const answer = responses[Math.floor(Math.random() * responses.length)];
	await interaction.reply(`🎱 **Q:** ${question}\n**A:** ${answer}`);
}