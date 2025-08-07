import { SlashCommandBuilder } from 'discord.js';
import { getDatabase } from '../../utils/database.js'; // Adjust path as needed

export const data = new SlashCommandBuilder()
  .setName('recruitment-message')
  .setDescription("Displays the unit's recruitment message.")
  .setContexts(0, 1, 2)
  .setDMPermission(true)
  .setIntegrationTypes(0, 1);

export async function execute(interaction) {
  const db = getDatabase();

  // Fetch latest application form config
  const config = db
    .prepare(
      `
		SELECT questions 
		FROM application_config 
		ORDER BY id DESC 
		LIMIT 1
	`
    )
    .get();

  let availableRolesText = 'Unavailable';

  try {
    if (config?.questions) {
      const questions = JSON.parse(config.questions);
      const mosField = questions.find(q => q.id === 'mos');

      if (mosField && Array.isArray(mosField.options)) {
        const openRoles = mosField.options
          .filter(opt => !opt.disabled && opt.value) // ignore empty/default entries
          .map(opt => `• ${opt.label}`);

        if (openRoles.length > 0) {
          availableRolesText = openRoles.join('\n');
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse roles from application_config:', err);
  }

  await interaction.reply({
    content: `**1A Recruitment Message**
        
1A is a MILSIM unit modeled after the **75th Ranger Regiment** during the **Global War on Terror**, specifically around the **2009 era**. We emphasize tight coordination, disciplined operations, and high standards — without unnecessary roleplay.
        
📘 More info: https://1a75.org/about
📝 Apply here: https://1a75.org/apply (login via Discord)
💬 Join our Discord: https://discord.gg/RAQwxfbu5H

**🎯 We are currently looking to fill:**
• **Squad 2** - Assault 2
• **Squad 3** - Security
• **Squad 4** - Weapons

**👑 Leadership Positions Needed:**
• Squad Leaders (Squads 2, 3, 4)
• Team Leaders (Squads 2, 3, 4)
        
**📋 Open MOS's (refer to the perstat for roles):**
${availableRolesText}`,
    ephemeral: false,
  });
}
