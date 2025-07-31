import {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionFlagsBits,
	ComponentType,
} from "discord.js";
import { getDatabase } from "../../utils/database.js";

const PAGE_SIZE = 20;
const EXCLUDED_ROLE_IDS = [
	"1363631767872864437",
	"1363618576895840398",
];

// Command definition
export const data = new SlashCommandBuilder()
	.setName("accountability")
	.setDescription("See who has NOT RSVP'd to an event")
	.addStringOption((option) =>
		option
			.setName("id")
			.setDescription("The ID of the event to check")
			.setRequired(true)
			.setAutocomplete(true),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Helper to build the embed and buttons
function buildEmbedAndRow(event, notRespondedList, page) {
	const total = notRespondedList.length;
	const maxPage = Math.ceil(total / PAGE_SIZE) || 1;
	const start = (page - 1) * PAGE_SIZE;
	const end = start + PAGE_SIZE;
	const pageList = notRespondedList.slice(start, end);

	let displayList =
		pageList.length > 0
			? pageList
					.map((m, i) => `${start + i + 1}. <@${m.id}>\n`)
					.join("\n")
			: "*Everyone has responded!*";

	if (displayList.length > 1024) {
		displayList = displayList.slice(0, 1020) + "...";
	}

	const embed = new EmbedBuilder()
		.setTitle(`Accountability for "${event.title}"`)
		.setDescription(
			`**Event Time:** <t:${event.time}:F>\n**Not Responded (${total}):**\n${displayList}`,
		)
		.setColor(0x5865f2)
		.setFooter({
			text: `Event ID: ${event.id} | Page ${page}/${maxPage}`,
		})
		.setTimestamp();

	const row = new ActionRowBuilder();
	row.addComponents(
		new ButtonBuilder()
			.setCustomId(`account_prev_${event.id}_${page}`)
			.setLabel("Previous")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 1),
		new ButtonBuilder()
			.setCustomId(`account_next_${event.id}_${page}`)
			.setLabel("Next")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === maxPage),
	);

	return { embed, row };
}

// Command execution
export async function execute(interaction) {
	try {
		const eventId = interaction.options.getString("id");
		const db = getDatabase();

		const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
		if (!event) {
			return await interaction.reply({
				content: `No event found with ID: \`${eventId}\``,
				ephemeral: true,
			});
		}

		const rsvps = db
			.prepare("SELECT user_id FROM rsvps WHERE event_id = ?")
			.all(eventId)
			.map((r) => r.user_id);

		await interaction.guild.members.fetch();
		const allMembers = interaction.guild.members.cache.filter(
			(m) =>
				!m.user.bot &&
				!EXCLUDED_ROLE_IDS.some((roleId) => m.roles.cache.has(roleId)),
		);

		const notResponded = allMembers.filter(
			(member) => !rsvps.includes(member.id),
		);

		const page = 1;
		const { embed, row } = buildEmbedAndRow(event, [...notResponded.values()], page);

		const reply = await interaction.reply({
			embeds: [embed],
			components: [row],
			ephemeral: false,
			fetchReply: true,
		});

		// Set up collector for pagination
		const collector = reply.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 5 * 60 * 1000, // 5 minutes
		});

		let currentPage = page;

		collector.on("collect", async (i) => {
			if (i.user.id !== interaction.user.id) {
				return i.reply({
					content: "Only the command user can use these buttons.",
					ephemeral: true,
				});
			}

			const [_, direction, eventIdFromBtn, pageFromBtn] =
				i.customId.split("_");
			let newPage = Number(pageFromBtn);

			if (direction === "prev") newPage--;
			if (direction === "next") newPage++;

			const { embed: newEmbed, row: newRow } = buildEmbedAndRow(
				event,
				[...notResponded.values()],
				newPage,
			);

			currentPage = newPage;
			await i.update({ embeds: [newEmbed], components: [newRow] });
		});

		collector.on("end", async () => {
			const { embed: finalEmbed } = buildEmbedAndRow(
				event,
				[...notResponded.values()],
				currentPage,
			);
			await reply.edit({ embeds: [finalEmbed], components: [] });
		});
	} catch (error) {
		console.error("Error in /accountability:", error);
		await interaction.reply({
			content: "There was an error checking accountability.",
			ephemeral: true,
		});
	}
}

// Autocomplete handler
export async function autocomplete(interaction) {
	try {
		const focusedValue = interaction.options.getFocused().toLowerCase();
		const db = getDatabase();

		// Get the start of today in UNIX timestamp (UTC)
		const now = new Date();
		const startOfToday = Math.floor(
			new Date(
				now.getUTCFullYear(),
				now.getUTCMonth(),
				now.getUTCDate()
			).getTime() / 1000
		);

		const events = db
			.prepare(
				`SELECT id, title, time FROM events WHERE time >= ? ORDER BY time ASC LIMIT 25`
			)
			.all(startOfToday);

		const filtered = events.filter(
			(event) =>
				event.id.toLowerCase().includes(focusedValue) ||
				event.title.toLowerCase().includes(focusedValue),
		);

		const choices = filtered.map((event) => {
			const timeString = `<t:${event.time}:R>`;
			return {
				name: `${event.title} (${timeString}) - ID: ${event.id}`,
				value: event.id,
			};
		});

		await interaction.respond(choices.slice(0, 25));
	} catch (error) {
		console.error("Error in /accountability autocomplete:", error);
		await interaction.respond([]);
	}
}