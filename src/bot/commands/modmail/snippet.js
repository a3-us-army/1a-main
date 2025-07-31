import {
	SlashCommandBuilder,
	PermissionFlagsBits,
} from "discord.js";
import { getSnippetByName, findSnippetNames } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("snippet")
	.setDescription("Send a canned response")
	.addStringOption((opt) =>
		opt
			.setName("name")
			.setDescription("Snippet name")
			.setRequired(true)
			.setAutocomplete(true)
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const name = interaction.options.getString("name");
	const snippet = getSnippetByName(name);
	if (!snippet) {
		return await interaction.editReply({
			content: "Snippet not found.",
		});
	}

	const channel = interaction.channel;
	if (!channel.name.startsWith("modmail-")) {
		return await interaction.editReply({
			content: "This is not a modmail channel.",
		});
	}

	// Send the snippet content in the channel, with sender info
	await channel.send({
		content: `${snippet.content}\n\n*Sent by <@${interaction.user.id}>*`,
	});

	await interaction.editReply({
		content: "Snippet sent in this channel.",
	});
}

// Autocomplete handler
export async function autocomplete(interaction) {
	const focused = interaction.options.getFocused();
	const matches = findSnippetNames(focused || "");
	await interaction.respond(
		matches.map((row) => ({
			name: row.name,
			value: row.name,
		}))
	);
}