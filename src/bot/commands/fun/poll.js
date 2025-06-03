import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("poll")
	.setDescription("Create a quick poll.")
	.addStringOption((opt) =>
		opt.setName("question").setDescription("Poll question").setRequired(true),
	)
	.addStringOption((opt) =>
		opt.setName("option1").setDescription("First option").setRequired(true),
	)
	.addStringOption((opt) =>
		opt.setName("option2").setDescription("Second option").setRequired(true),
	);

export async function execute(interaction) {
	const question = interaction.options.getString("question");
	const option1 = interaction.options.getString("option1");
	const option2 = interaction.options.getString("option2");
	const msg = await interaction.reply({
		content: `📊 **${question}**\n\n🇦 ${option1}\n🇧 ${option2}`,
		fetchReply: true,
	});
	await msg.react("🇦");
	await msg.react("🇧");
}