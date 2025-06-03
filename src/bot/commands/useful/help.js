import {
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	PermissionsBitField,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";

const BUTTONS_PER_ROW = 5;

const CATEGORY_DESCRIPTIONS = {
	Certification: "Manage and view certifications.",
	Events: "Event scheduling and information.",
	Useful: "Helpful utilities and info.",
	General: "General purpose commands.",
	Equipment: "Manage and view equipment.",
	Fun: "Fun silly little commands",
	Tag: "Tag commands that we can use instead of copy and pasting.",
	Admin: "Admin Commands.",
};

export const data = new SlashCommandBuilder()
	.setName("help")
	.setDescription("Show all available commands and their descriptions");

function getMention(cmd, sub = null, group = null) {
	if (group && sub) {
		return `</${cmd.name} ${group} ${sub}:${cmd.id}>`;
	}
	if (sub) {
		return `</${cmd.name} ${sub}:${cmd.id}>`;
	}
	return `</${cmd.name}:${cmd.id}>`;
}

function userHasPermission(cmd, member) {
	if (!cmd.default_member_permissions || cmd.default_member_permissions === "0")
		return true;
	const required = BigInt(cmd.default_member_permissions);
	const userPerms = member.permissions?.bitfield ?? BigInt(0);
	return (userPerms & required) === required;
}

export async function execute(interaction) {
	try {
		const manifestPath = path.join(process.cwd(), "commands-manifest.json");
		if (!fs.existsSync(manifestPath)) {
			return await interaction.reply({
				content:
					"Command manifest not found. Please ask an admin to register commands.",
			});
		}
		const commands = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

		// Show all commands, regardless of permissions
		const filteredCommands = commands;

		// Group commands by category (folder path)
		const categories = {};
		for (const cmd of filteredCommands) {
			const cat = cmd.category || "General";
			if (!categories[cat]) categories[cat] = [];
			categories[cat].push(cmd);
		}

		const categoryNames = Object.keys(categories);
		const totalCommands = filteredCommands.length;

		if (categoryNames.length === 0) {
			return await interaction.reply({
				content: "No commands found.",
			});
		}

		let page = -1; // -1 = home page

		const getHomeEmbed = () => {
			const embed = new EmbedBuilder()
				.setTitle("Bot Help")
				.setColor(0x5865f2)
				.setDescription(
					"Welcome! Use the select menu or buttons below to view commands by category.",
				)
				.addFields(
					categoryNames.map((cat) => ({
						name: `${cat}`,
						value: CATEGORY_DESCRIPTIONS[cat] || "No description.",
						inline: false,
					})),
				)
				.setFooter({
					text: `Total commands: ${totalCommands} • Use the select menu or buttons below to navigate.`,
				});
			return embed;
		};

		const getCategoryEmbed = (pageIdx) => {
			const cat = categoryNames[pageIdx];
			const cmds = categories[cat];
			const lines = [];
			for (const cmd of cmds) {
				if (
					Array.isArray(cmd.options) &&
					cmd.options.some((opt) => opt.type === 1 || opt.type === 2)
				) {
					for (const opt of cmd.options) {
						if (opt.type === 1) {
							lines.push(
								`${getMention(cmd, opt.name)} — ${opt.description || "No description"}`,
							);
						} else if (opt.type === 2 && Array.isArray(opt.options)) {
							for (const sub of opt.options) {
								if (sub.type === 1) {
									lines.push(
										`${getMention(cmd, sub.name, opt.name)} — ${sub.description || "No description"}`,
									);
								}
							}
						}
					}
				} else {
					lines.push(
						cmd.id
							? `</${cmd.name}:${cmd.id}> — ${cmd.description || "No description"}`
							: `/${cmd.name} — ${cmd.description || "No description"}`,
					);
				}
			}
			const embed = new EmbedBuilder()
				.setTitle(`Bot Commands — ${cat}`)
				.setColor(0x5865f2)
				.setDescription(
					(CATEGORY_DESCRIPTIONS[cat]
						? `*${CATEGORY_DESCRIPTIONS[cat]}*\n\n`
						: "") + lines.join("\n\n"),
				)
				.setFooter({
					text: `Category ${pageIdx + 1} of ${categoryNames.length} • Total commands: ${totalCommands} • Use the select menu or buttons below to navigate or return home.`,
				});
			return embed;
		};

		const getHomeRow = () => {
			return [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("help_category_select")
						.setPlaceholder("Jump to category...")
						.addOptions(
							categoryNames.map((cat, idx) => ({
								label: cat,
								value: String(idx),
								description: CATEGORY_DESCRIPTIONS[cat] || undefined,
							})),
						),
				),
			];
		};

		const getCategoryRow = (pageIdx) => {
			return [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId("help_prev")
						.setEmoji("1373866203361316884")
						.setStyle(ButtonStyle.Secondary)
						.setDisabled(pageIdx === 0),
					new ButtonBuilder()
						.setCustomId("help_home")
						.setEmoji("1373867270685851760")
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId("help_next")
						.setEmoji("1373866163058249759")
						.setStyle(ButtonStyle.Secondary)
						.setDisabled(pageIdx === categoryNames.length - 1),
				),
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("help_category_select")
						.setPlaceholder("Jump to category...")
						.addOptions(
							categoryNames.map((cat, idx) => ({
								label: cat,
								value: String(idx),
								description: CATEGORY_DESCRIPTIONS[cat] || undefined,
							})),
						),
				),
			];
		};

		await interaction.reply({
			embeds: [getHomeEmbed()],
			components: getHomeRow(),
			ephemeral: false,
		});

		const msg = await interaction.fetchReply();

		const collector = msg.createMessageComponentCollector({
			filter: (i) => i.user.id === interaction.user.id,
			time: 2 * 60 * 1000,
		});

		collector.on("collect", async (i) => {
			if (i.isStringSelectMenu() && i.customId === "help_category_select") {
				page = Number(i.values[0]);
				await i.update({
					embeds: [getCategoryEmbed(page)],
					components: getCategoryRow(page),
				});
			} else if (i.customId === "help_home") {
				page = -1;
				await i.update({
					embeds: [getHomeEmbed()],
					components: getHomeRow(),
				});
			} else if (i.customId === "help_prev" && page > 0) {
				page--;
				await i.update({
					embeds: [getCategoryEmbed(page)],
					components: getCategoryRow(page),
				});
			} else if (
				i.customId === "help_next" &&
				page < categoryNames.length - 1
			) {
				page++;
				await i.update({
					embeds: [getCategoryEmbed(page)],
					components: getCategoryRow(page),
				});
			}
		});

		collector.on("end", async () => {
			try {
				await msg.edit({ components: [] });
			} catch {}
		});
	} catch (error) {
		console.error("Error in help command:", error);
		await interaction.reply({
			content: "There was an error generating the help message.",
		});
	}
}
