import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";
import path from "path";

const contributersRaw = JSON.parse(
	fs.readFileSync(
		path.join(process.cwd(), "src/bot/config/contributors.json"),
		"utf8",
	),
);

const contributers = contributersRaw
	.map((c) => `<@${c.userID}> - ${c.position} ${c.emoji}`)
	.join("\n");

export const data = new SlashCommandBuilder()
	.setName("info")
	.setDescription("Information on this bot.");

export async function execute(interaction) {
	const embed = new EmbedBuilder()
		.setTitle("1A Administration")
		.setColor(0x454b1b)
		.setThumbnail("https://i.imgur.com/LjwUiUZ.png")
		.setAuthor({
			name: "1A Administration",
			iconURL: "https://i.imgur.com/LjwUiUZ.png",
		})
		.addFields(
			{ name: "Bot Owner", value: "<@829909201262084096>", inline: true },
			{ name: "Contributors", value: contributers, inline: true },
			{
				name: "Source Code",
				value: "[Click Here](https://go.cag-ussof.org/cag-bot)",
				inline: true,
			},
			{
				name: "About 1A Administration",
				value:
					"1A Administration is a multipurpose Discord bot built to simplify communication and management for the US Army community. It helps you quickly share information, organize resources, and streamline server administration.",
				inline: true,
			},
		);

	await interaction.reply({ embeds: [embed] });
}
