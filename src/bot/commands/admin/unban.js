import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user by ID or name')
  .addStringOption(opt =>
    opt
      .setName('user')
      .setDescription('User to unban (ID or name)')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
  const userInput = interaction.options.getString('user');

  // Try to find the ban by ID or username/tag
  let banInfo;
  try {
    const bans = await interaction.guild.bans.fetch();
    banInfo =
      bans.find(
        ban =>
          ban.user.id === userInput ||
          ban.user.tag.toLowerCase().includes(userInput.toLowerCase()) ||
          ban.user.username.toLowerCase().includes(userInput.toLowerCase())
      ) || null;
  } catch (e) {
    banInfo = null;
  }

  if (!banInfo) {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Unban Failed')
      .setDescription('User not found in ban list.');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  try {
    await interaction.guild.bans.remove(banInfo.user.id);
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('User Unbanned')
      .setDescription(`Unbanned ${banInfo.user.tag} (<@${banInfo.user.id}>)`);
    await interaction.reply({ embeds: [embed] });
  } catch {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Unban Failed')
      .setDescription('Failed to unban. User may not be banned.');
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused();
  let bans;
  try {
    bans = await interaction.guild.bans.fetch();
  } catch {
    bans = new Map();
  }

  // Filter bans by input (username, tag, or ID)
  const choices = [...bans.values()]
    .filter(
      ban =>
        ban.user.tag.toLowerCase().includes(focused.toLowerCase()) ||
        ban.user.username.toLowerCase().includes(focused.toLowerCase()) ||
        ban.user.id.startsWith(focused)
    )
    .slice(0, 25) // Discord allows max 25 choices
    .map(ban => ({
      name: `${ban.user.tag} (${ban.user.id})`,
      value: ban.user.id,
    }));

  await interaction.respond(choices);
}
