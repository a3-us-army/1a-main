import {
	SlashCommandBuilder,
	PermissionFlagsBits,
} from "discord.js";
import { editSnippetByName, getSnippetByName, findSnippetNames } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("edit-snippet")
	.setDescription("Edit a canned response")
	.addStringOption((opt) =>
		opt
			.setName("name")
			.setDescription("Snippet name")
			.setRequired(true)
			.setAutocomplete(true)
	)
	.addStringOption((opt) =>
		opt.setName("content").setDescription("New snippet content").setRequired(true)
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const name = interaction.options.getString("name");
	const content = interaction.options.getString("content");
	const snippet = getSnippetByName(name);

	if (!snippet) {
		return await interaction.editReply({
			content: "Snippet not found.",
		});
	}

	editSnippetByName(name, content);

	await interaction.editReply({
		content: `Snippet \`${name}\` updated!`,
	});
}

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