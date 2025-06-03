import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabase, returnEquipmentForEvent } from "../../utils/database.js";

export const data = new SlashCommandBuilder()
	.setName("delete-event")
	.setDescription("Delete an event by its ID")
	.addStringOption((option) =>
		option
			.setName("id")
			.setDescription("The ID of the event to delete")
			.setRequired(true)
			.setAutocomplete(true),
	);

export async function execute(interaction) {
	try {
		const eventId = interaction.options.getString("id");
		const db = getDatabase();

		const event = db
			.prepare(
				"SELECT title, message_id, channel_id, creator_id FROM events WHERE id = ?",
			)
			.get(eventId);

		if (!event) {
			return await interaction.reply({
				content: `No event found with ID: \`${eventId}\``,
				ephemeral: true,
			});
		}

		if (
			event.creator_id !== interaction.user.id &&
			!interaction.member.permissions.has("ADMINISTRATOR")
		) {
			return await interaction.reply({
				content:
					"You can only delete events that you created or if you're an administrator.",
				ephemeral: true,
			});
		}

		let messageDeleted = false;
		try {
			await interaction.deferReply();

			console.log("Attempting to delete message...");
			console.log("Channel ID:", event.channel_id);
			console.log("Message ID:", event.message_id);

			const channel = await interaction.client.channels.fetch(event.channel_id);

			if (channel) {
				const message = await channel.messages.fetch(event.message_id);
				if (message) {
					await message.delete();
					messageDeleted = true;
					console.log("Message deleted successfully");
				}
			}
		} catch (messageError) {
			console.error("Error deleting message:", messageError);
		}

		// Return equipment to inventory before deleting event and requests
		returnEquipmentForEvent(eventId);

		// Delete the event and all associated data from the database
		db.transaction(() => {
			db.prepare("DELETE FROM sent_reminders WHERE event_id = ?").run(eventId);
			db.prepare("DELETE FROM rsvps WHERE event_id = ?").run(eventId);
			db.prepare("DELETE FROM equipment_requests WHERE event_id = ?").run(
				eventId,
			);
			db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
		})();

		const embed = new EmbedBuilder()
			.setTitle("Event Deleted")
			.setColor(0x00ff00)
			.setDescription(`Successfully deleted event: **${event.title}**`)
			.addFields({
				name: "Event ID",
				value: `\`${eventId}\``,
			});

		if (messageDeleted) {
			embed.addFields({
				name: "Discord Message",
				value: "The event message was also deleted from the channel.",
			});
		} else {
			embed.addFields({
				name: "Discord Message",
				value:
					"The event message could not be deleted. It may have been deleted already or the bot lacks permissions.",
			});
		}

		embed.setTimestamp();

		await interaction.editReply({ embeds: [embed] });
	} catch (error) {
		console.error("Error executing delete-event command:", error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({
				content: "There was an error deleting the event.",
				ephemeral: true,
			});
		} else {
			await interaction.editReply({
				content: "There was an error deleting the event.",
			});
		}
	}
}

// Autocomplete handler
export async function autocomplete(interaction) {
	try {
		const focusedValue = interaction.options.getFocused().toLowerCase();
		const db = getDatabase();

		const events = db
			.prepare(`
        SELECT id, title, time 
        FROM events
        ORDER BY time ASC 
        LIMIT 25
      `)
			.all();

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
		console.error("Error handling autocomplete:", error);
		await interaction.respond([]);
	}
}
