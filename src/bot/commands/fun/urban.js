import {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from "discord.js";
import fetch from "node-fetch";

export const data = new SlashCommandBuilder()
	.setName("urban")
	.setDescription("Look up a word on Urban Dictionary.")
	.addStringOption((opt) =>
		opt.setName("word").setDescription("Word to look up").setRequired(true),
	);

export async function execute(interaction) {
	const word = interaction.options.getString("word");
	const res = await fetch(
		`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`,
	);
	const data = await res.json();

	if (!data.list || data.list.length === 0) {
		return interaction.reply({
			content: `No results found for **${word}**.`,
			ephemeral: true,
		});
	}

	let index = 0;
	const definitions = data.list;

	const getEmbed = (idx) => {
		const def = definitions[idx];
		return new EmbedBuilder()
			.setTitle(`Urban Dictionary: ${def.word}`)
			.setURL(def.permalink)
			.setColor(0x1d2439)
			.setDescription(
				def.definition.length > 2048
					? `${def.definition.slice(0, 2045)}...`
					: def.definition,
			)
			.addFields(
				{ name: "👍 Thumbs Up", value: def.thumbs_up.toString(), inline: true },
				{
					name: "👎 Thumbs Down",
					value: def.thumbs_down.toString(),
					inline: true,
				},
			)
			.setFooter({
				text: `Definition ${idx + 1} of ${definitions.length}${def.example ? " • Example below" : ""}`,
			})
			.setTimestamp()
			.setAuthor({ name: def.author });
	};

	const getRow = (idx) => {
		return new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId("urban_prev")
				.setLabel("Previous")
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(idx === 0),
			new ButtonBuilder()
				.setCustomId("urban_next")
				.setLabel("Next")
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(idx === definitions.length - 1),
		);
	};

	await interaction.reply({
		embeds: [getEmbed(index)],
		components: definitions.length > 1 ? [getRow(index)] : [],
		ephemeral: false,
	});

	if (definitions.length > 1) {
		const msg = await interaction.fetchReply();
		const collector = msg.createMessageComponentCollector({
			filter: (i) => i.user.id === interaction.user.id,
			time: 60 * 1000,
		});

		collector.on("collect", async (i) => {
			if (i.customId === "urban_prev" && index > 0) {
				index--;
			} else if (
				i.customId === "urban_next" &&
				index < definitions.length - 1
			) {
				index++;
			}
			await i.update({
				embeds: [getEmbed(index)],
				components: [getRow(index)],
			});
		});

		collector.on("end", async () => {
			try {
				await msg.edit({ components: [] });
			} catch {}
		});
	}
}
