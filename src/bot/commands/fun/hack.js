import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("hack")
	.setDescription("Pretend to hack a user (for fun!)")
	.addUserOption(opt =>
		opt.setName("user").setDescription("User to hack").setRequired(true)
	);

export async function execute(interaction) {
	const user = interaction.options.getUser("user");
	await interaction.reply(`🖥️ Hacking ${user}...\n[▓▓▓░░░░░░░░░░] 20%`);
	setTimeout(() => interaction.editReply(`🖥️ Hacking ${user}...\n[▓▓▓▓▓▓▓░░░░] 70%`), 1500);
	setTimeout(() => interaction.editReply(`🖥️ Hacking ${user}...\n[▓▓▓▓▓▓▓▓▓▓] 100%\n✅ Hack complete!`), 3000);
}