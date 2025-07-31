import {
	SlashCommandBuilder,
	PermissionFlagsBits,
} from "discord.js";
import { deleteSnippetByName, findSnippetNames } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("delete-snippet")
	.setDescription("Delete a canned response")
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
	deleteSnippetByName(name);

	await interaction.editReply({
		content: `Snippet \`${name}\` deleted (if it existed).`,
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