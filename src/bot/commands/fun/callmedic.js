import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

const medicMemes = [
	"https://tenor.com/view/medic-tf2-memes-heavy-call-phone-call-gif-9535759091527992333",
	"https://tenor.com/view/medic-tf-team-fortress2-team-fortress-meme-gif-26690143",
	"https://tenor.com/view/medical-meme-russianbadger-youtube-rich-gif-16645964969419550862",
];

export const data = new SlashCommandBuilder()
	.setName("callmedic")
	.setDescription("Call for a medic (sends a meme).");

export async function execute(interaction) {
	const meme = medicMemes[Math.floor(Math.random() * medicMemes.length)];
	const embed = new EmbedBuilder()
		.setTitle("Medic!")
		.setImage(meme)
		.setColor(0xe74c3c);
	await interaction.reply({ embeds: [embed], ephemeral: false });
}
