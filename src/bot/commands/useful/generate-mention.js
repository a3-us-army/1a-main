import { SlashCommandBuilder } from "discord.js";
import fs from "fs";
import path from "path";

const manifestPath = path.join(process.cwd(), "commands-manifest.json");

export const data = new SlashCommandBuilder()
	.setName("generate-mention")
	.setDescription("Generate a mention for any slash command")
	.addStringOption((opt) =>
		opt
			.setName("command")
			.setDescription("The command to mention")
			.setRequired(true)
			.setAutocomplete(true),
	)
	.addStringOption((opt) =>
		opt
			.setName("subcommandgroup")
			.setDescription("Subcommand group (if applicable)")
			.setRequired(false)
			.setAutocomplete(true),
	)
	.addStringOption((opt) =>
		opt
			.setName("subcommand")
			.setDescription("Subcommand (if applicable)")
			.setRequired(false)
			.setAutocomplete(true),
	);

export async function autocomplete(interaction) {
	try {
		const focused = interaction.options.getFocused(true);
		const options = interaction.options;
		if (!fs.existsSync(manifestPath)) return await interaction.respond([]);

		const commands = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

		if (focused.name === "command") {
			const choices = commands.map((cmd) => ({
				name: `/${cmd.name}`,
				value: cmd.name,
			}));
			const filtered = choices.filter((choice) =>
				choice.name.toLowerCase().includes(focused.value.toLowerCase()),
			);
			return await interaction.respond(filtered.slice(0, 25));
		}

		const commandName = options.getString("command");
		const cmd = commands.find((c) => c.name === commandName);
		if (!cmd) return await interaction.respond([]);

		if (focused.name === "subcommandgroup") {
			if (!Array.isArray(cmd.options)) return await interaction.respond([]);
			const groups = cmd.options.filter((opt) => opt.type === 2);
			const choices = groups.map((g) => ({
				name: g.name,
				value: g.name,
			}));
			const filtered = choices.filter((choice) =>
				choice.name.toLowerCase().includes(focused.value.toLowerCase()),
			);
			return await interaction.respond(filtered.slice(0, 25));
		}

		if (focused.name === "subcommand") {
			let subcommands = [];
			const groupName = options.getString("subcommandgroup");
			if (groupName) {
				const group = cmd.options?.find(
					(opt) => opt.type === 2 && opt.name === groupName,
				);
				if (group && Array.isArray(group.options)) {
					subcommands = group.options.filter((opt) => opt.type === 1);
				}
			} else {
				subcommands = (cmd.options || []).filter((opt) => opt.type === 1);
			}
			const choices = subcommands.map((sc) => ({
				name: sc.name,
				value: sc.name,
			}));
			const filtered = choices.filter((choice) =>
				choice.name.toLowerCase().includes(focused.value.toLowerCase()),
			);
			return await interaction.respond(filtered.slice(0, 25));
		}
	} catch (error) {
		console.error("Error in mention autocomplete:", error);
		await interaction.respond([]);
	}
}

export async function execute(interaction) {
	const commandName = interaction.options.getString("command");
	const subcommandGroup = interaction.options.getString("subcommandgroup");
	const subcommand = interaction.options.getString("subcommand");

	if (!fs.existsSync(manifestPath)) {
		return await interaction.reply({
			content: "Command manifest not found.",
			ephemeral: true,
		});
	}
	const commands = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	const cmd = commands.find((c) => c.name === commandName);

	if (!cmd) {
		return await interaction.reply({
			content: "Command not found.",
			ephemeral: true,
		});
	}

	let mention;
	if (subcommandGroup && subcommand) {
		mention = `</${cmd.name} ${subcommandGroup} ${subcommand}:${cmd.id}>`;
	} else if (subcommand) {
		mention = `</${cmd.name} ${subcommand}:${cmd.id}>`;
	} else {
		mention = `</${cmd.name}:${cmd.id}>`;
	}

	await interaction.reply({
		content: `${mention}`,
		ephemeral: false,
	});
}
