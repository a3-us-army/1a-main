import {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from "discord.js";

export function buildEventEmbed(event, rsvps = null) {
	const desc = event.description?.trim()
		? event.description.trim()
		: "No description provided.";
	const embed = new EmbedBuilder()
		.setTitle(event.title)
		.setDescription(
			`${desc}\n\n**Event Time**: <t:${event.time}:F> (<t:${event.time}:R>)\n\n**Location**: ${event.location || "N/A"}`,
		)
		.setColor(0x5865f2)
		.setTimestamp()
		.setFooter({ text: `Event ID: ${event.id || "N/A"}` });

	if (event.image) {
		embed.setThumbnail(event.image);
	} else {
		embed.setThumbnail("https://cdn.xanderxx.xyz/1a-logo.png");
	}

	if (rsvps) {
		// If RSVP data is provided, add RSVP fields
		const { goingUsers, notGoingUsers, maybeUsers } = rsvps;
		const goingMentions = goingUsers.length
			? goingUsers.map((u) => `<@${u.user_id}>`).join("\n")
			: "No one";
		const notGoingMentions = notGoingUsers.length
			? notGoingUsers.map((u) => `<@${u.user_id}>`).join("\n")
			: "No one";
		const maybeMentions = maybeUsers.length
			? maybeUsers.map((u) => `<@${u.user_id}>`).join("\n")
			: "No one";

		embed.addFields(
			{
				name: `<:checkmark:1365157872685547540> Attending (${goingUsers.length})`,
				value: goingMentions,
				inline: true,
			},
			{
				name: `<:x_:1365157886908567592> Not Attending (${notGoingUsers.length})`,
				value: notGoingMentions,
				inline: true,
			},
			{
				name: `<:question:1365157901450346536> Maybe (${maybeUsers.length})`,
				value: maybeMentions,
				inline: true,
			},
		);
	}

	// --- RSVP BUTTONS ---
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`rsvp_${event.id}_yes`)
			.setEmoji("1365157872685547540")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`rsvp_${event.id}_no`)
			.setEmoji("1365157886908567592")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`rsvp_${event.id}_maybe`)
			.setEmoji("1365157901450346536")
			.setStyle(ButtonStyle.Secondary),
	);

	return { embed, components: [row] };
}
