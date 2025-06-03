import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("nuke")
	.setDescription("Nuke someplace!")
	.addStringOption((option) =>
		option
			.setName("where")
			.setDescription("Where are you nuking?")
			.setRequired(true),
	);

export async function execute(interaction) {
	const userId = interaction.user.id;
	const place = interaction.options.getString("where");

	await interaction.reply(
		`<@${userId}> has nuked ${place}! <:nuke:1299927172638707763> <:nuke:1299927172638707763> <:nuke:1299927172638707763>`,
	);
}