// bot/utils/modmail.js

import fs from "node:fs";
import path from "node:path";
import {
    ChannelType,
    EmbedBuilder,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import {
    MODMAIL_CATEGORY_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_ENDPOINT,
    R2_PUBLIC_URL,
    MODMAIL_GUILD_ID
} from "../config/modmail.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const BLOCKLIST_PATH = path.resolve(__dirname, "./json/blocklist.json");

// --- Blocklist helpers ---

export async function isUserBlocked(userId) {
    if (!fs.existsSync(BLOCKLIST_PATH)) return false;
    const list = JSON.parse(fs.readFileSync(BLOCKLIST_PATH));
    return list.includes(userId);
}
export async function blockUser(userId) {
    let list = [];
    if (fs.existsSync(BLOCKLIST_PATH)) list = JSON.parse(fs.readFileSync(BLOCKLIST_PATH));
    if (!list.includes(userId)) list.push(userId);
    fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify(list));
}
export async function unblockUser(userId) {
    if (!fs.existsSync(BLOCKLIST_PATH)) return;
    let list = JSON.parse(fs.readFileSync(BLOCKLIST_PATH));
    list = list.filter(id => id !== userId);
    fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify(list));
}

// --- Message mapping helpers ---

const DM_TO_MODMAIL_PATH = path.resolve(__dirname, "./json/dm-to-modmail.json");
const MODMAIL_TO_DM_PATH = path.resolve(__dirname, "./json/modmail-to-dm.json");

function loadMap(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath));
}
function saveMap(filePath, map) {
    fs.writeFileSync(filePath, JSON.stringify(map));
}

export async function addMessageMapping(dmMsgId, modmailMsgId, channelId) {
    const dmToModmail = loadMap(DM_TO_MODMAIL_PATH);
    const modmailToDm = loadMap(MODMAIL_TO_DM_PATH);

    dmToModmail[dmMsgId] = { modmailMsgId, channelId };
    modmailToDm[modmailMsgId] = { dmMsgId, channelId };

    saveMap(DM_TO_MODMAIL_PATH, dmToModmail);
    saveMap(MODMAIL_TO_DM_PATH, modmailToDm);
}

export async function getMappedMessageIdByDm(dmMsgId) {
    const dmToModmail = loadMap(DM_TO_MODMAIL_PATH);
    return dmToModmail[dmMsgId] || null;
}

export async function getMappedMessageIdByModmail(modmailMsgId) {
    const modmailToDm = loadMap(MODMAIL_TO_DM_PATH);
    return modmailToDm[modmailMsgId] || null;
}

export async function removeMessageMapping(dmMsgId, modmailMsgId) {
    const dmToModmail = loadMap(DM_TO_MODMAIL_PATH);
    const modmailToDm = loadMap(MODMAIL_TO_DM_PATH);

    if (dmMsgId) delete dmToModmail[dmMsgId];
    if (modmailMsgId) delete modmailToDm[modmailMsgId];

    saveMap(DM_TO_MODMAIL_PATH, dmToModmail);
    saveMap(MODMAIL_TO_DM_PATH, modmailToDm);
}

// --- Find or create modmail channel ---

export async function findOrCreateModmailChannel(user, client) {
    const guild = client.guilds.cache.get(MODMAIL_GUILD_ID);
    if (!guild) {
        console.error("Modmail: Guild not found for ID", MODMAIL_GUILD_ID);
        return null;
    }

    // Try to get the member to fetch their nickname
    let member;
    try {
        member = await guild.members.fetch(user.id);
    } catch {
        member = null;
    }
    const nickname = member?.nickname || user.username;

    // Sanitize nickname for channel name (Discord channel names must be lowercase, no spaces, etc.)
    const safeNick = nickname
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80); // Discord channel name max length is 100

    const channelName = `modmail-${safeNick}-${user.id}`;

    let channel = guild.channels.cache.find(
        ch => ch.parentId === MODMAIL_CATEGORY_ID && ch.name === channelName
    );
    if (!channel) {
        channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: MODMAIL_CATEGORY_ID,
            topic: `Modmail thread for ${user.tag} (${user.id}) | USER_ID:${user.id}`,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                // Optionally allow staff role
            ],
        });
        await channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setTitle("📬 New Modmail Thread")
                    .setDescription(`User: ${user.tag} (<@${user.id}>)\nID: ${user.id}
                        
                        Start your message with "!!" to make the bot ignore it.`)
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp(),
            ],
        });
    }
    return channel;
}

// --- Post user message as embed with buttons ---

async function hasThreadButtons(channel) {
    // Fetch the last 20 messages in the channel
    const messages = await channel.messages.fetch({ limit: 20 });
    return messages.some(msg =>
        msg.author.id === channel.client.user.id &&
        msg.components.length > 0 &&
        msg.components.some(row =>
            row.components.some(
                c =>
                    c.data &&
                    (c.data.custom_id === "close_thread" ||
                        c.data.custom_id === "tag_thread")
            )
        )
    );
}

export async function postUserMessageToChannel(message, channel) {
    let withButtons = false;

    // Only add buttons if they don't already exist in the channel
    if (!(await hasThreadButtons(channel))) {
        withButtons = true;
    }

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({
            name: message.author.tag,
            iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(message.content || "*No text content*")
        .setFooter({ text: `User ID: ${message.author.id}` })
        .setTimestamp();

    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (
            attachment.contentType &&
            attachment.contentType.startsWith("image/")
        ) {
            embed.setImage(attachment.url);
        } else {
            embed.addFields({
                name: "Attachment",
                value: `[File](${attachment.url})`,
                inline: false,
            });
        }
    }

    let components = [];
    if (withButtons) {
        components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("close_thread")
                    .setLabel("Close Thread")
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId("tag_thread")
                    .setLabel("Tag Thread")
                    .setStyle(ButtonStyle.Primary)
            ),
        ];
    }

    return await channel.send({ embeds: [embed], components });
}

// --- Message edit/delete sync ---

export async function syncEdit(oldMsg, newMsg, client) {
    const mapping = await getMappedMessageId(oldMsg.id);
    if (!mapping) return;
    const guild = client.guilds.cache.get(MODMAIL_GUILD_ID);
    const channel = guild.channels.cache.get(mapping.channelId);
    if (!channel) return;
    const modmailMsg = await channel.messages.fetch(mapping.modmailMsgId).catch(() => null);
    if (!modmailMsg) return;

    // Edit the embed
    const embed = EmbedBuilder.from(modmailMsg.embeds[0])
        .setDescription(newMsg.content || "*No text content*")
        .setFooter({ text: `User ID: ${oldMsg.author.id} (edited)` })
        .setTimestamp();
    await modmailMsg.edit({ embeds: [embed] });
}

export async function syncDelete(msg, client) {
    const mapping = await getMappedMessageId(msg.id);
    if (!mapping) return;
    const guild = client.guilds.cache.get(MODMAIL_GUILD_ID);
    const channel = guild.channels.cache.get(mapping.channelId);
    if (!channel) return;
    const modmailMsg = await channel.messages.fetch(mapping.modmailMsgId).catch(() => null);
    if (!modmailMsg) return;
    await modmailMsg.delete();
    await removeMessageMapping(msg.id);
}

// --- Transcript export ---

export async function saveTranscript(channel) {
    // Extract user ID from channel name
    const parts = channel.name.split("-");
    const userId = parts[parts.length - 1];
    let userTag = "Unknown User";
    let userObj = null;
    try {
        userObj = await channel.client.users.fetch(userId);
        userTag = `${userObj.tag} (${userObj.id})`;
    } catch {
        userTag = `Unknown User (${userId})`;
    }

    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = Array.from(messages.values()).sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp
    );
    const lines = await Promise.all(sorted.map(async m => {
        let content = m.content;
        if (!content && m.embeds.length > 0 && m.embeds[0].description) {
            content = m.embeds[0].description;
        }
        if (m.attachments.size > 0) {
            content =
                (content || "") +
                " [Attachment: " +
                Array.from(m.attachments.values())
                    .map(a => a.url)
                    .join(", ") +
                "]";
        }
        // Format date in America/New_York (EST/EDT)
        const dateStr = new Date(m.createdTimestamp).toLocaleString("en-US", {
            timeZone: "America/New_York",
        });

        // If the message is from the bot, show the modmail user instead
        let authorTag = m.author.tag;
        if (userObj && m.author.id === channel.client.user.id) {
            authorTag = userObj.tag;
        }

        return `[${dateStr}] ${authorTag}: ${content || ""}`;
    }));

    // Add headers
    const header = [
        "==== Modmail Transcript ====",
        `This thread was for: ${userTag}`,
        `All times are in EST`,
        "",
        "==== User Messages ====",
        ""
    ];

    const filePath = `/tmp/transcript-${channel.id}.txt`;
    fs.writeFileSync(filePath, header.concat(lines).join("\n"));
    return filePath;
}

// --- R2 Upload ---

export async function uploadTranscriptToR2(filePath, fileName) {
    const client = new S3Client({
        region: "auto",
        endpoint: R2_ENDPOINT,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    });

    const fileContent = fs.readFileSync(filePath);

    const key = `transcripts/${fileName}`;

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: fileContent,
        ContentType: "text/plain",
    });

    await client.send(command);

    // Return the public URL
    return `${R2_PUBLIC_URL}/transcripts/${fileName}`;
}

// --- Get user from modmail channel name ---
export async function getUserFromModmailChannel(channel) {
    if (!channel.name.startsWith("modmail-")) return null;
    return channel.name.replace("modmail-", "");
}

// --- Tag thread (edit channel topic or send message) ---
export async function tagThread(channel, tag) {
    await channel.setTopic(`${channel.topic || ""} [Tag: ${tag}]`);
    await channel.send({ content: `Thread tagged as **${tag}**.` });
}

export function extractUserIdFromTopic(topic) {
    if (!topic) return null;
    const match = topic.match(/USER_ID:(\d{17,})/);
    return match ? match[1] : null;
}