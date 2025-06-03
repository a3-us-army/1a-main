import { EmbedBuilder, AuditLogEvent, ChannelType } from "discord.js";

// --- Hardcoded per-guild log channel mapping ---
// Replace these with your actual guild and channel IDs
const guildLogChannels = {
	// "guildId": "logChannelId"
	"1332773894293160039": "1332773896369209371", // Example Guild 1
};

const logChannelCache = new Map();

async function getLogChannel(guild) {
	if (!guild) return null;
	if (logChannelCache.has(guild.id)) return logChannelCache.get(guild.id);

	const logChannelId = guildLogChannels[guild.id];
	if (!logChannelId) return null;

	try {
		const channel = await guild.channels.fetch(logChannelId);
		if (channel?.isTextBased()) {
			logChannelCache.set(guild.id, channel);
			return channel;
		}
	} catch (e) {
		console.error(`Failed to fetch log channel for guild ${guild.id}:`, e);
	}
	return null;
}

// --- Helper functions ---
function formatAttachments(attachments) {
	if (!attachments || attachments.size === 0) return null;
	return Array.from(attachments.values())
		.map((att) => `[${att.name}](${att.url})`)
		.join("\n");
}

function jumpLink(guildId, channelId, messageId) {
	return `[${messageId}](https://discord.com/channels/${guildId}/${channelId}/${messageId})`;
}

// --- Invite cache for tracking used invites ---
const invitesCache = new Map();

export function setupFullLogger(client) {
	// --- Invite cache setup ---
	client.on("ready", async () => {
		// biome-ignore lint/complexity/noForEach: <explanation>
		client.guilds.cache.forEach(async (guild) => {
			try {
				const invites = await guild.invites.fetch();
				invitesCache.set(guild.id, invites);
			} catch {}
		});
	});

	client.on("inviteCreate", async (invite) => {
		const invites = await invite.guild.invites.fetch();
		invitesCache.set(invite.guild.id, invites);
	});

	client.on("inviteDelete", async (invite) => {
		const invites = await invite.guild.invites.fetch();
		invitesCache.set(invite.guild.id, invites);
	});

	// --- Member Join (with invite tracking) ---
	client.on("guildMemberAdd", async (member) => {
		// Invite tracking
		const cachedInvites = invitesCache.get(member.guild.id);
		const newInvites = await member.guild.invites.fetch();
		invitesCache.set(member.guild.id, newInvites);

		const usedInvite = newInvites.find(
			(inv) => cachedInvites?.get(inv.code)?.uses < inv.uses,
		);

		const channel = await getLogChannel(member.guild);
		if (!channel) return;

		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setTitle("Member Joined")
			.addFields(
				{
					name: "User",
					value: `${member.username} (<@${member.id}>)`,
					inline: true,
				},
				{ name: "User ID", value: member.id, inline: true },
				{
					name: "Account Created",
					value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
					inline: true,
				},
			)
			.setFooter({ text: `User ID: ${member.id}` })
			.setTimestamp();

		if (usedInvite) {
			embed.addFields({
				name: "Invite Used",
				value: `\`${usedInvite.code}\` (by ${usedInvite.inviter?.tag || "Unknown"})`,
				inline: false,
			});
		} else {
			embed.addFields({
				name: "Invite Used",
				value: "Unknown",
				inline: false,
			});
		}

		await channel.send({ embeds: [embed] });

		// Auto-role (optional, comment out if not needed)
		const roleId = "1363618576895840398";
		try {
			await member.roles.add(roleId, "Auto-assigned on join");
			e;
		} catch (error) {
			console.error(`Failed to assign role to ${member.user.tag}:`, error);
		}
	});

	// --- Member Leave / Kick ---
	client.on("guildMemberRemove", async (member) => {
        setTimeout(async () => {
            let mod = "Unknown";
            let reason = "No reason provided";
            let kicked = false;
            try {
                const fetchedLogs = await member.guild.fetchAuditLogs({
                    type: AuditLogEvent.MemberKick,
                    limit: 5,
                });
                const kickLog = fetchedLogs.entries.find(
                    (entry) =>
                        entry.target.id === member.id &&
                        Date.now() - entry.createdTimestamp < 20000,
                );
                if (kickLog) {
                    kicked = true;
                    mod = `${kickLog.executor} (<@${kickLog.executor.id}>)`;
                    reason = kickLog.reason || "No reason provided";
                }
            } catch (e) {
                console.error("Error fetching kick audit log:", e);
            }
    
            const channel = await getLogChannel(member.guild);
            if (!channel) return;
    
            const embed = new EmbedBuilder()
                .setColor(kicked ? 0xe67e22 : 0x95a5a6)
                .setTitle(kicked ? "User Kicked" : "Member Left")
                .addFields(
                    {
                        name: "User",
                        value: member.user.tag, // Just their name and tag, no ping
                        inline: true,
                    },
                    {
                        name: "Nickname",
                        value: member.nickname ? member.nickname : "None",
                        inline: true,
                    },
                    { name: "User ID", value: member.id, inline: true },
                    {
                        name: "Account Created",
                        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                        inline: true,
                    },
                )
                .setFooter({ text: `User ID: ${member.id}` })
                .setTimestamp();
    
            if (kicked) {
                embed.addFields(
                    { name: "Moderator", value: mod, inline: true },
                    { name: "Reason", value: reason, inline: false },
                );
            }
    
            await channel.send({ embeds: [embed] });
        }, 1000);
    });

	// --- Ban ---
	client.on("guildBanAdd", async (ban) => {
		const { guild, user } = ban;
		let mod = "Unknown";
		let reason = "No reason provided";
		try {
			const fetchedLogs = await guild.fetchAuditLogs({
				type: AuditLogEvent.MemberBanAdd,
				limit: 5,
			});
			const banLog = fetchedLogs.entries.find(
				(entry) =>
					entry.target.id === user.id &&
					Date.now() - entry.createdTimestamp < 10000,
			);
			if (banLog) {
				mod = `${banLog.executor} (<@${banLog.executor.id}>)`;
				reason = banLog.reason || "No reason provided";
			}
		} catch {}

		const channel = await getLogChannel(guild);
		if (!channel) return;

		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("User Banned")
			.addFields(
				{ name: "User", value: `${user} (<@${user.id}>)`, inline: true },
				{ name: "User ID", value: user.id, inline: true },
				{ name: "Moderator", value: mod, inline: true },
				{ name: "Reason", value: reason, inline: false },
			)
			.setFooter({ text: `User ID: ${user.id}` })
			.setTimestamp();

		await channel.send({ embeds: [embed] });
	});

	// --- Unban ---
	client.on("guildBanRemove", async (ban) => {
		const { guild, user } = ban;
		const channel = await getLogChannel(guild);
		if (!channel) return;

		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setTitle("User Unbanned")
			.addFields(
				{ name: "User", value: `${user} (<@${user.id}>)`, inline: true },
				{ name: "User ID", value: user.id, inline: true },
			)
			.setFooter({ text: `User ID: ${user.id}` })
			.setTimestamp();

		await channel.send({ embeds: [embed] });
	});

	// --- Message Edit ---
	client.on("messageUpdate", async (oldMsg, newMsg) => {
		if (
			oldMsg.partial ||
			newMsg.partial ||
			oldMsg.author?.bot ||
			!oldMsg.guild ||
			(oldMsg.content === newMsg.content &&
				!oldMsg.attachments?.size &&
				!newMsg.attachments?.size)
		)
			return;
		const channel = await getLogChannel(oldMsg.guild);
		if (!channel) return;

		const beforeAttachments = formatAttachments(oldMsg.attachments);
		const afterAttachments = formatAttachments(newMsg.attachments);

		const embed = new EmbedBuilder()
			.setColor(0xf1c40f)
			.setTitle("Message edited")
			.addFields(
				{
					name: "Channel",
					value: `${oldMsg.channel} (\`#${oldMsg.channel.name}\`)`,
					inline: true,
				},
				{
					name: "Message ID",
					value: jumpLink(oldMsg.guild.id, oldMsg.channel.id, oldMsg.id),
					inline: true,
				},
				{
					name: "Created",
					value: `<t:${Math.floor(oldMsg.createdTimestamp / 1000)}:R>`,
					inline: true,
				},
				{
					name: "Author",
					value: `${oldMsg.author} (<@${oldMsg.author.id}>)`,
					inline: true,
				},
				{
					name: "Before",
					value: oldMsg.content || "*No content*",
					inline: false,
				},
				{
					name: "After",
					value: newMsg.content || "*No content*",
					inline: false,
				},
			)
			.setFooter({ text: `User ID: ${oldMsg.author.id}` })
			.setTimestamp();

		if (beforeAttachments) {
			embed.addFields({
				name: "Before Attachments",
				value: beforeAttachments,
				inline: false,
			});
		}
		if (afterAttachments) {
			embed.addFields({
				name: "After Attachments",
				value: afterAttachments,
				inline: false,
			});
		}

		await channel.send({ embeds: [embed] });
	});

	// --- Message Delete ---
	client.on("messageDelete", async (message) => {
		if (message.partial || message.author?.bot || !message.guild) return;
		const channel = await getLogChannel(message.guild);
		if (!channel) return;
		const attachments = formatAttachments(message.attachments);
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Message deleted")
			.addFields(
				{
					name: "Channel",
					value: `${message.channel} (\`#${message.channel.name}\`)`,
					inline: true,
				},
				{
					name: "Message ID",
					value: jumpLink(message.guild.id, message.channel.id, message.id),
					inline: true,
				},
				{
					name: "Created",
					value: `<t:${Math.floor(message.createdTimestamp / 1000)}:R>`,
					inline: true,
				},
				{
					name: "Author",
					value: `${message.author} (<@${message.author.id}>)`,
					inline: true,
				},
				{
					name: "Message",
					value: message.content || "*No content*",
					inline: false,
				},
			)
			.setFooter({ text: `User ID: ${message.author.id}` })
			.setTimestamp();
		if (attachments) {
			embed.addFields({
				name: "Attachments",
				value: attachments,
				inline: false,
			});
		}
		await channel.send({ embeds: [embed] });
	});

	// --- Bulk Message Delete ---
	client.on("messageDeleteBulk", async (messages) => {
		const channelObj = messages.first()?.channel;
		const channel = await getLogChannel(channelObj.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Bulk Message Delete")
			.addFields(
				{
					name: "Channel",
					value: `${channelObj} (\`#${channelObj.name}\`)`,
					inline: true,
				},
				{ name: "Messages Deleted", value: `${messages.size}`, inline: true },
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Channel Created ---
	client.on("channelCreate", async (channelObj) => {
		const channel = await getLogChannel(channelObj.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setTitle("Channel Created")
			.addFields(
				{
					name: "Channel",
					value: `${channelObj} (\`#${channelObj.name}\`)`,
					inline: true,
				},
				{ name: "Type", value: `\`${channelObj.type}\``, inline: true },
			)
			.setFooter({ text: `Channel ID: ${channelObj.id}` })
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Channel Deleted ---
	client.on("channelDelete", async (channelObj) => {
		const channel = await getLogChannel(channelObj.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Channel Deleted")
			.addFields(
				{ name: "Channel", value: `${channelObj.name}`, inline: true },
				{ name: "Type", value: `\`${channelObj.type}\``, inline: true },
			)
			.setFooter({ text: `Channel ID: ${channelObj.id}` })
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Channel Updated (basic info) ---
	client.on("channelUpdate", async (oldChannel, newChannel) => {
		const channel = await getLogChannel(newChannel.guild);
		if (!channel) return;
		const changes = [];
		if (oldChannel.name !== newChannel.name) {
			changes.push({
				name: "Name",
				value: `\`${oldChannel.name}\` → \`${newChannel.name}\``,
				inline: false,
			});
		}
		if (oldChannel.type !== newChannel.type) {
			changes.push({
				name: "Type",
				value: `\`${oldChannel.type}\` → \`${newChannel.type}\``,
				inline: false,
			});
		}
		if ("topic" in oldChannel && oldChannel.topic !== newChannel.topic) {
			changes.push({
				name: "Topic",
				value: `\`${oldChannel.topic || "None"}\` → \`${newChannel.topic || "None"}\``,
				inline: false,
			});
		}
		if ("nsfw" in oldChannel && oldChannel.nsfw !== newChannel.nsfw) {
			changes.push({
				name: "NSFW",
				value: `\`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\``,
				inline: false,
			});
		}
		if ("bitrate" in oldChannel && oldChannel.bitrate !== newChannel.bitrate) {
			changes.push({
				name: "Bitrate",
				value: `\`${oldChannel.bitrate}\` → \`${newChannel.bitrate}\``,
				inline: false,
			});
		}
		if (
			"userLimit" in oldChannel &&
			oldChannel.userLimit !== newChannel.userLimit
		) {
			changes.push({
				name: "User Limit",
				value: `\`${oldChannel.userLimit}\` → \`${newChannel.userLimit}\``,
				inline: false,
			});
		}
		if (changes.length === 0) return;
		const embed = new EmbedBuilder()
			.setColor(0x7289da)
			.setTitle("Channel Updated")
			.addFields(
				{
					name: "Channel",
					value: `${newChannel} (\`#${newChannel.name}\`)`,
					inline: true,
				},
				...changes,
			)
			.setFooter({ text: `Channel ID: ${newChannel.id}` })
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Channel Permissions Updated ---
	client.on("channelUpdate", async (oldChannel, newChannel) => {
		if (
			![
				ChannelType.GuildText,
				ChannelType.GuildVoice,
				ChannelType.GuildAnnouncement,
				ChannelType.GuildForum,
				ChannelType.GuildStageVoice,
			].includes(newChannel.type)
		)
			return;

		const oldPerms = oldChannel.permissionOverwrites.cache;
		const newPerms = newChannel.permissionOverwrites.cache;

		if (
			oldPerms.size === newPerms.size &&
			oldPerms.every((v, k) => {
				const n = newPerms.get(k);
				return (
					n &&
					n.allow.bitfield === v.allow.bitfield &&
					n.deny.bitfield === v.deny.bitfield
				);
			})
		)
			return;

		let executor = null;
		try {
			const fetchedLogs = await newChannel.guild.fetchAuditLogs({
				type: AuditLogEvent.ChannelOverwriteUpdate,
				limit: 5,
			});
			const log = fetchedLogs.entries.find(
				(entry) =>
					entry.target &&
					entry.target.id === newChannel.id &&
					Date.now() - entry.createdTimestamp < 10000,
			);
			if (log?.executor) executor = log.executor;
		} catch (err) {
			console.error("Error fetching channel permission audit logs:", err);
		}

		const embed = new EmbedBuilder()
			.setColor(0x7289da)
			.setTitle("Channel Permissions Updated")
			.addFields(
				{
					name: "Channel",
					value: `${newChannel} (\`#${newChannel.name}\`)`,
					inline: true,
				},
				{
					name: "Updated By",
					value: executor ? `${executor.tag} (<@${executor.id}>)` : "Unknown",
					inline: true,
				},
			)
			.setFooter({ text: `Channel ID: ${newChannel.id}` })
			.setTimestamp();

		const changes = [];
		for (const [id, newOverwrite] of newPerms) {
			const oldOverwrite = oldPerms.get(id);
			if (!oldOverwrite) {
				changes.push(`+ Added overwrite for <@&${id}>`);
			} else if (
				newOverwrite.allow.bitfield !== oldOverwrite.allow.bitfield ||
				newOverwrite.deny.bitfield !== oldOverwrite.deny.bitfield
			) {
				changes.push(`~ Changed overwrite for <@&${id}>`);
			}
		}
		for (const [id, oldOverwrite] of oldPerms) {
			if (!newPerms.has(id)) {
				changes.push(`- Removed overwrite for <@&${id}>`);
			}
		}
		if (changes.length) {
			embed.addFields({
				name: "Changes",
				value: changes.join("\n"),
				inline: false,
			});
		}

		const channel = await getLogChannel(newChannel.guild);
		if (channel) await channel.send({ embeds: [embed] });
	});

	// --- Voice State Update (Join/Leave/Move) ---
	client.on("voiceStateUpdate", async (oldState, newState) => {
		const user = newState.member?.user || oldState.member?.user;
		if (!user) return;
		const channel = await getLogChannel(newState.guild || oldState.guild);
		if (!channel) return;

		// --- JOIN ---
		if (!oldState.channel && newState.channel) {
			const embed = new EmbedBuilder()
				.setColor(0x2ecc71)
				.setTitle("Voice Channel Joined")
				.addFields(
					{ name: "User", value: `${user} (<@${user.id}>)`, inline: true },
					{
						name: "Channel",
						value: `${newState.channel} (\`#${newState.channel.name}\`)`,
						inline: true,
					},
				)
				.setFooter({ text: `User ID: ${user.id}` })
				.setTimestamp();
			await channel.send({ embeds: [embed] });
		}

		// --- LEAVE or KICK ---
		else if (oldState.channel && !newState.channel) {
			let kickedBy = null;
			try {
				const fetchedLogs = await oldState.guild.fetchAuditLogs({
					type: AuditLogEvent.MemberDisconnect,
					limit: 5,
				});
				const disconnectLog = fetchedLogs.entries.find(
					(entry) =>
						entry.target &&
						entry.target.id === oldState.id &&
						Date.now() - entry.createdTimestamp < 5000,
				);
				if (disconnectLog?.executor) {
					kickedBy = disconnectLog.executor;
				}
			} catch (err) {}

			const embed = new EmbedBuilder()
				.setColor(0xe74c3c)
				.setTitle(kickedBy ? "Voice Channel Kick" : "Voice Channel Left")
				.addFields(
					{ name: "User", value: `${user} (<@${user.id}>)`, inline: true },
					{
						name: "Channel",
						value: `${oldState.channel} (\`#${oldState.channel.name}\`)`,
						inline: true,
					},
				)
				.setFooter({ text: `User ID: ${user.id}` })
				.setTimestamp();

			if (kickedBy) {
				embed.addFields({
					name: "Kicked By",
					value: `${kickedBy.tag} (<@${kickedBy.id}>)`,
					inline: true,
				});
			}

			await channel.send({ embeds: [embed] });
		}

		// --- MOVE (self or admin) ---
		else if (
			oldState.channel &&
			newState.channel &&
			oldState.channel.id !== newState.channel.id
		) {
			let movedBy = null;
			try {
				const fetchedLogs = await newState.guild.fetchAuditLogs({
					type: AuditLogEvent.MemberMove,
					limit: 5,
				});
				const moveLog = fetchedLogs.entries.find(
					(entry) =>
						entry.target &&
						entry.target.id === newState.id &&
						Date.now() - entry.createdTimestamp < 5000,
				);
				if (moveLog?.executor) {
					movedBy = moveLog.executor;
				}
			} catch (err) {}

			const embed = new EmbedBuilder()
				.setColor(0xf1c40f)
				.setTitle(
					movedBy ? "Voice Channel Moved (by Admin)" : "Voice Channel Moved",
				)
				.addFields(
					{ name: "User", value: `${user} (<@${user.id}>)`, inline: true },
					{
						name: "From",
						value: `${oldState.channel} (\`#${oldState.channel.name}\`)`,
						inline: true,
					},
					{
						name: "To",
						value: `${newState.channel} (\`#${newState.channel.name}\`)`,
						inline: true,
					},
				)
				.setFooter({ text: `User ID: ${user.id}` })
				.setTimestamp();

			if (movedBy) {
				embed.addFields({
					name: "Moved By",
					value: `${movedBy.tag} (<@${movedBy.id}>)`,
					inline: true,
				});
			}

			await channel.send({ embeds: [embed] });
		}
	});

	// --- Role Create ---
	client.on("roleCreate", async (role) => {
		const channel = await getLogChannel(role.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setTitle("Role Created")
			.addFields(
				{ name: "Role", value: `${role} (\`${role.name}\`)`, inline: true },
				{ name: "Role ID", value: role.id, inline: true },
				{ name: "Color", value: role.hexColor, inline: true },
				{
					name: "Mentionable",
					value: role.mentionable ? "Yes" : "No",
					inline: true,
				},
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Role Delete ---
	client.on("roleDelete", async (role) => {
		const channel = await getLogChannel(role.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Role Deleted")
			.addFields(
				{ name: "Role", value: `${role.name}`, inline: true },
				{ name: "Role ID", value: role.id, inline: true },
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Role Update ---
	client.on("roleUpdate", async (oldRole, newRole) => {
		const channel = await getLogChannel(newRole.guild);
		if (!channel) return;

		const changes = [];
		if (oldRole.name !== newRole.name) {
			changes.push({
				name: "Name",
				value: `\`${oldRole.name}\` → \`${newRole.name}\``,
				inline: false,
			});
		}
		if (oldRole.color !== newRole.color) {
			changes.push({
				name: "Color",
				value: `\`${oldRole.hexColor}\` → \`${newRole.hexColor}\``,
				inline: false,
			});
		}
		if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
			changes.push({
				name: "Permissions",
				value: `\`${oldRole.permissions.bitfield}\` → \`${newRole.permissions.bitfield}\``,
				inline: false,
			});
		}
		if (oldRole.mentionable !== newRole.mentionable) {
			changes.push({
				name: "Mentionable",
				value: `\`${oldRole.mentionable}\` → \`${newRole.mentionable}\``,
				inline: false,
			});
		}
		if (changes.length === 0) return;

		// Fetch audit log for who updated the role
		let updatedBy = "Unknown";
		try {
			const fetchedLogs = await newRole.guild.fetchAuditLogs({
				type: AuditLogEvent.RoleUpdate,
				limit: 5,
			});
			const log = fetchedLogs.entries.find(
				(entry) =>
					entry.target &&
					entry.target.id === newRole.id &&
					Date.now() - entry.createdTimestamp < 10000,
			);
			if (log?.executor) {
				updatedBy = `${log.executor.tag} (<@${log.executor.id}>)`;
			}
		} catch (err) {
			console.error("Error fetching role update audit logs:", err);
		}

		const embed = new EmbedBuilder()
			.setColor(0x7289da)
			.setTitle("Role Updated")
			.addFields(
				{
					name: "Role",
					value: `${newRole} (\`${newRole.name}\`)`,
					inline: true,
				},
				{
					name: "Updated By",
					value: updatedBy,
					inline: true,
				},
				...changes,
			)
			.setTimestamp();

		await channel.send({ embeds: [embed] });
	});

	// --- Emoji Create ---
	client.on("emojiCreate", async (emoji) => {
		const channel = await getLogChannel(emoji.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setTitle("Emoji Created")
			.addFields(
				{ name: "Emoji", value: `${emoji} (\`${emoji.name}\`)`, inline: true },
				{ name: "Emoji ID", value: emoji.id, inline: true },
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Emoji Delete ---
	client.on("emojiDelete", async (emoji) => {
		const channel = await getLogChannel(emoji.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Emoji Deleted")
			.addFields(
				{ name: "Emoji", value: `${emoji.name}`, inline: true },
				{ name: "Emoji ID", value: emoji.id, inline: true },
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Emoji Update ---
	client.on("emojiUpdate", async (oldEmoji, newEmoji) => {
		const channel = await getLogChannel(newEmoji.guild);
		if (!channel) return;
		const changes = [];
		if (oldEmoji.name !== newEmoji.name) {
			changes.push({
				name: "Name",
				value: `\`${oldEmoji.name}\` → \`${newEmoji.name}\``,
				inline: false,
			});
		}
		if (changes.length === 0) return;
		const embed = new EmbedBuilder()
			.setColor(0x7289da)
			.setTitle("Emoji Updated")
			.addFields(
				{
					name: "Emoji",
					value: `${newEmoji} (\`${newEmoji.name}\`)`,
					inline: true,
				},
				...changes,
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Sticker Create ---
	client.on("stickerCreate", async (sticker) => {
		const channel = await getLogChannel(sticker.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setTitle("Sticker Created")
			.addFields(
				{ name: "Sticker", value: `${sticker.name}`, inline: true },
				{ name: "Sticker ID", value: sticker.id, inline: true },
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Sticker Delete ---
	client.on("stickerDelete", async (sticker) => {
		const channel = await getLogChannel(sticker.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Sticker Deleted")
			.addFields(
				{ name: "Sticker", value: `${sticker.name}`, inline: true },
				{ name: "Sticker ID", value: sticker.id, inline: true },
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Sticker Update ---
	client.on("stickerUpdate", async (oldSticker, newSticker) => {
		const channel = await getLogChannel(newSticker.guild);
		if (!channel) return;
		const changes = [];
		if (oldSticker.name !== newSticker.name) {
			changes.push({
				name: "Name",
				value: `\`${oldSticker.name}\` → \`${newSticker.name}\``,
				inline: false,
			});
		}
		if (changes.length === 0) return;
		const embed = new EmbedBuilder()
			.setColor(0x7289da)
			.setTitle("Sticker Updated")
			.addFields(
				{ name: "Sticker", value: `${newSticker.name}`, inline: true },
				...changes,
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- User Update (username, avatar, banner) ---
	const GUILD_ID = process.env.GUILD_ID;
	client.on("userUpdate", async (oldUser, newUser) => {
		const guild = client.guilds.cache.get(GUILD_ID);
		if (!guild) return;
		const channel = await getLogChannel(guild);
		if (!channel) return;
		const changes = [];
		if (oldUser.username !== newUser.username) {
			changes.push({
				name: "Username",
				value: `\`${oldUser.username}\` → \`${newUser.username}\``,
				inline: false,
			});
		}
		if (oldUser.avatar !== newUser.avatar) {
			changes.push({
				name: "Avatar Changed",
				value: `[Old Avatar](${oldUser.displayAvatarURL()}) → [New Avatar](${newUser.displayAvatarURL()})`,
				inline: false,
			});
		}
		if (oldUser.banner !== newUser.banner) {
			changes.push({
				name: "Banner Changed",
				value: `[Old Banner](${oldUser.bannerURL() || "N/A"}) → [New Banner](${newUser.bannerURL() || "N/A"})`,
				inline: false,
			});
		}
		if (changes.length === 0) return;
		const embed = new EmbedBuilder()
			.setColor(0x3498db)
			.setTitle("User Updated")
			.setDescription(`<@${newUser.id}>`)
			.addFields(...changes)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Guild Update ---
	client.on("guildUpdate", async (oldGuild, newGuild) => {
		const channel = await getLogChannel(newGuild);
		if (!channel) return;
		const changes = [];
		if (oldGuild.name !== newGuild.name) {
			changes.push({
				name: "Server Name",
				value: `\`${oldGuild.name}\` → \`${newGuild.name}\``,
				inline: false,
			});
		}
		if (oldGuild.icon !== newGuild.icon) {
			changes.push({
				name: "Server Icon Changed",
				value: `[Old Icon](${oldGuild.iconURL() || "N/A"}) → [New Icon](${newGuild.iconURL() || "N/A"})`,
				inline: false,
			});
		}
		if (oldGuild.banner !== newGuild.banner) {
			changes.push({
				name: "Server Banner Changed",
				value: `[Old Banner](${oldGuild.bannerURL() || "N/A"}) → [New Banner](${newGuild.bannerURL() || "N/A"})`,
				inline: false,
			});
		}
		if (oldGuild.ownerId !== newGuild.ownerId) {
			changes.push({
				name: "Owner Changed",
				value: `<@${oldGuild.ownerId}> → <@${newGuild.ownerId}>`,
				inline: false,
			});
		}
		if (changes.length === 0) return;
		const embed = new EmbedBuilder()
			.setColor(0x7289da)
			.setTitle("Server Updated")
			.addFields(...changes)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Soundboard Sound Create ---
	client.on("guildSoundboardSoundCreate", async (sound) => {
		const channel = await getLogChannel(sound.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setTitle("Soundboard Sound Created")
			.addFields(
				{ name: "Sound", value: `${sound.name}`, inline: true },
				{ name: "Sound ID", value: sound.id, inline: true },
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Soundboard Sound Delete ---
	client.on("guildSoundboardSoundDelete", async (sound) => {
		const channel = await getLogChannel(sound.guild);
		if (!channel) return;
		const embed = new EmbedBuilder()
			.setColor(0xe74c3c)
			.setTitle("Soundboard Sound Deleted")
			.addFields(
				{ name: "Sound", value: `${sound.name}`, inline: true },
				{ name: "Sound ID", value: sound.id, inline: true },
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Soundboard Sound Update ---
	client.on("guildSoundboardSoundUpdate", async (oldSound, newSound) => {
		const channel = await getLogChannel(newSound.guild);
		if (!channel) return;
		const changes = [];
		if (oldSound.name !== newSound.name) {
			changes.push({
				name: "Name",
				value: `\`${oldSound.name}\` → \`${newSound.name}\``,
				inline: false,
			});
		}
		if (changes.length === 0) return;
		const embed = new EmbedBuilder()
			.setColor(0x7289da)
			.setTitle("Soundboard Sound Updated")
			.addFields(
				{ name: "Sound", value: `${newSound.name}`, inline: true },
				...changes,
			)
			.setTimestamp();
		await channel.send({ embeds: [embed] });
	});

	// --- Member Nickname Update ---
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const channel = await getLogChannel(newMember.guild);
		if (!channel) return;

		if (oldMember.nickname === newMember.nickname) return;

		// Fetch audit log for who updated the nickname
		let updatedBy = "Unknown";
		try {
			const fetchedLogs = await newMember.guild.fetchAuditLogs({
				type: AuditLogEvent.MemberUpdate,
				limit: 5,
			});
			const log = fetchedLogs.entries.find(
				(entry) =>
					entry.target &&
					entry.target.id === newMember.id &&
					Date.now() - entry.createdTimestamp < 10000,
			);
			if (log?.executor) {
				updatedBy = `${log.executor.tag} (<@${log.executor.id}>)`;
			}
		} catch (err) {
			console.error("Error fetching member update audit logs:", err);
		}

		const embed = new EmbedBuilder()
			.setColor(0x9b59b6)
			.setTitle("Nickname Updated")
			.addFields(
				{
					name: "User",
					value: `${newMember.user.tag} (<@${newMember.id}>)`,
					inline: true,
				},
				{
					name: "Updated By",
					value: updatedBy,
					inline: true,
				},
				{
					name: "Old Nickname",
					value: oldMember.nickname ? `\`${oldMember.nickname}\`` : "*None*",
					inline: false,
				},
				{
					name: "New Nickname",
					value: newMember.nickname ? `\`${newMember.nickname}\`` : "*None*",
					inline: false,
				},
			)
			.setFooter({ text: `User ID: ${newMember.id}` })
			.setTimestamp();

		await channel.send({ embeds: [embed] });
	});

	// --- Member Roles Update ---
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const channel = await getLogChannel(newMember.guild);
		if (!channel) return;

		// Get role IDs before and after
		const oldRoles = new Set(oldMember.roles.cache.keys());
		const newRoles = new Set(newMember.roles.cache.keys());

		// Find added and removed roles
		const addedRoles = [...newRoles].filter((id) => !oldRoles.has(id));
		const removedRoles = [...oldRoles].filter((id) => !newRoles.has(id));

		// If no role changes, skip
		if (addedRoles.length === 0 && removedRoles.length === 0) return;

		// Fetch audit log for who updated the roles
		let updatedBy = "Unknown";
		try {
			const fetchedLogs = await newMember.guild.fetchAuditLogs({
				type: AuditLogEvent.MemberRoleUpdate,
				limit: 5,
			});
			const log = fetchedLogs.entries.find(
				(entry) =>
					entry.target &&
					entry.target.id === newMember.id &&
					Date.now() - entry.createdTimestamp < 10000,
			);
			if (log?.executor) {
				updatedBy = `${log.executor.tag} (<@${log.executor.id}>)`;
			}
		} catch (err) {
			console.error("Error fetching member role update audit logs:", err);
		}

		const embed = new EmbedBuilder()
			.setColor(0x3498db)
			.setTitle("Member Roles Updated")
			.addFields(
				{
					name: "User",
					value: `${newMember.user.tag} (<@${newMember.id}>)`,
					inline: true,
				},
				{
					name: "Updated By",
					value: updatedBy,
					inline: true,
				},
			)
			.setFooter({ text: `User ID: ${newMember.id}` })
			.setTimestamp();

		if (addedRoles.length > 0) {
			embed.addFields({
				name: "Roles Added",
				value: addedRoles.map((id) => `<@&${id}>`).join(", "),
				inline: false,
			});
		}
		if (removedRoles.length > 0) {
			embed.addFields({
				name: "Roles Removed",
				value: removedRoles.map((id) => `<@&${id}>`).join(", "),
				inline: false,
			});
		}

		await channel.send({ embeds: [embed] });
	});

	// --- Add your other events here, always using await getLogChannel(guild) ---

	// --- Error Logging ---
	client.on("error", async (error) => {
		// biome-ignore lint/complexity/noForEach: <explanation>
		client.guilds.cache.forEach(async (guild) => {
			const channel = await getLogChannel(guild);
			if (!channel) return;
			const embed = new EmbedBuilder()
				.setColor(0xe74c3c)
				.setTitle("Bot Error")
				.setDescription(`\`\`\`${error.stack || error}\`\`\``)
				.setTimestamp();
			await channel.send({ embeds: [embed] });
		});
	});

	process.on("unhandledRejection", async (error) => {
		// biome-ignore lint/complexity/noForEach: <explanation>
		client.guilds.cache.forEach(async (guild) => {
			const channel = await getLogChannel(guild);
			if (!channel) return;
			const embed = new EmbedBuilder()
				.setColor(0xe74c3c)
				.setTitle("Unhandled Promise Rejection")
				.setDescription(`\`\`\`${error.stack || error}\`\`\``)
				.setTimestamp();
			await channel.send({ embeds: [embed] });
		});
	});
}
