import { SlashCommandBuilder } from 'discord.js';
import { getDatabase } from '../../utils/database.js';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('recruitment-message')
  .setDescription("Displays the unit's recruitment message.")
  .setContexts(0, 1, 2)
  .setDMPermission(true)
  .setIntegrationTypes(0, 1);

// Function to fetch and analyze personnel data from Google Sheets
async function getPersonnelData() {
  try {
    const sheetUrl =
      'https://docs.google.com/spreadsheets/d/11b5ZnMwxw3qj66q3-PMy0YHFOn5Th_I-NnsJH5cRrF4/export?format=csv&gid=9697998';
    const response = await fetch(sheetUrl);
    const csv = await response.text();

    const rows = parse(csv, { skip_empty_lines: false, trim: true });

    // Find the header row - look for position, callsign, status, name pattern
    const headerRowIdx = rows.findIndex(
      row =>
        row[0]?.toLowerCase().includes('position') &&
        row[1]?.toLowerCase().includes('callsign') &&
        row[2]?.toLowerCase().includes('status') &&
        row[3]?.toLowerCase().includes('name')
    );

    if (headerRowIdx === -1) {
      // If no header row found, assume first row is header
      console.log('No header row found, using first row as header');
    }

    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 1;
    const personnel = [];
    let currentSquad = null;

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (row.every(cell => !cell || cell.trim() === '')) continue;
      
          // Track current squad from header rows - be more specific
    if (row[0]?.toLowerCase().includes('platoon') && row[0]?.toLowerCase().includes('squad')) {
      // Extract squad number from header (e.g., "1st Platoon, 4th Squad (Weapons)")
      const squadMatch = row[0].match(/(\d+)(?:st|nd|rd|th)\s*squad/i);
      if (squadMatch) {
        currentSquad = squadMatch[1];
        console.log(`Found squad header: ${row[0]} -> Squad ${currentSquad}`);
      }
      continue;
    }
    
    // Handle other platoon-level headers
    if (row[0]?.toLowerCase().includes('platoon') && !row[0]?.toLowerCase().includes('squad')) {
      currentSquad = null;
      console.log(`Reset squad for platoon header: ${row[0]}`);
      continue;
    }
    
    // Only reset currentSquad if we encounter major section headers (not individual positions)
    if (row[0] && row[1] === '' && row[2] === '' && row[3] === '') {
      // This is likely a section header (only first column has content)
      if (row[0]?.toLowerCase().includes('company') || 
          row[0]?.toLowerCase().includes('battalion') ||
          row[0]?.toLowerCase().includes('section') ||
          row[0]?.toLowerCase().includes('reserves')) {
        currentSquad = null;
        console.log(`Reset squad for section header: ${row[0]}`);
        continue;
      }
    }
      
              const person = {
          position: row[0] ? row[0].trim() : '',
          callsign: row[1] ? row[1].trim() : '',
          status: row[2] ? row[2].trim() : '',
          name: row[3] ? row[3].trim() : '',
          squad: currentSquad
        };
        
        // Only include if we have a position and we know which squad it belongs to
        if (person.position && currentSquad) {
          personnel.push(person);
          console.log(`Added: ${person.position} (${person.callsign}) to Squad ${currentSquad}`);
        } else if (person.position && !currentSquad) {
          console.log(`Skipped: ${person.position} - no squad assigned`);
        }
    }

    return personnel;
  } catch (error) {
    console.error('Failed to fetch personnel from Google Sheets:', error);
    return null;
  }
}

// Function to analyze personnel data and find open positions
function analyzePersonnelData(personnel) {
  if (!personnel || personnel.length === 0) {
    return {
      openSquads: [],
      leadershipNeeds: [],
      openPositions: []
    };
  }

  const openSquads = [];
  const leadershipNeeds = [];
  const openPositions = [];

  // Group by squad
  const squadData = {};
  
  // Process all personnel data
  personnel.forEach(person => {
    const position = person.position || '';
    const status = person.status || '';
    const name = person.name || '';
    const squadNum = person.squad || '';
    
    // Skip closed positions (not recruiting)
    if (status.toLowerCase() === 'closed') {
      return;
    }
    
    if (squadNum) {
      if (!squadData[squadNum]) {
        squadData[squadNum] = {
          positions: [],
          leadership: [],
          filled: 0,
          total: 0
        };
      }
      
      squadData[squadNum].total++;
      squadData[squadNum].positions.push(position);
      
      // Check if position is filled (Active or Active Reserve)
      if ((status.toLowerCase() === 'active' || status.toLowerCase() === 'active reserve') && name.trim()) {
        squadData[squadNum].filled++;
      } else if (status.toLowerCase() === 'empty' || !name.trim()) {
        // Position is empty - check if it's leadership
        if (position.toLowerCase().includes('squad leader') || 
            position.toLowerCase().includes('team leader') ||
            position.toLowerCase().includes('gun tl') ||
            position.toLowerCase().includes('at team leader')) {
          leadershipNeeds.push({
            squad: `Squad ${squadNum}`,
            position: position
          });
        } else {
          openPositions.push({
            squad: `Squad ${squadNum}`,
            position: position
          });
        }
      }
    }
  });
  
  console.log('Raw personnel data:', personnel.slice(0, 10));
  console.log('Squad data after processing:', squadData);

  // Find squads that are not full
  Object.entries(squadData).forEach(([squadNum, data]) => {
    if (data.filled < data.total && data.total > 0) {
      const fillPercentage = (data.filled / data.total) * 100;
      // Consider squad open if less than 70% filled or has less than 6 members
      if (fillPercentage < 70 || data.filled < 6) {
        openSquads.push({
          squad: `Squad ${squadNum}`,
          filled: data.filled,
          total: data.total,
          percentage: Math.round(fillPercentage)
        });
      }
    }
  });

  return {
    openSquads,
    leadershipNeeds,
    openPositions,
    squadData
  };
}

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

  // Fetch and analyze personnel data
  const personnel = await getPersonnelData();
  console.log('Personnel data sample:', personnel?.slice(0, 5));
  const analysis = analyzePersonnelData(personnel);
  console.log('Analysis result:', analysis);

  // Build recruitment message sections
  let openSquadsText = '• No specific squads identified';
  if (analysis.openSquads.length > 0) {
    openSquadsText = analysis.openSquads
      .map(squad => `• **${squad.squad}** - ${squad.filled}/${squad.total} filled (${squad.percentage}%)`)
      .join('\n');
  }

  let leadershipText = '• No specific leadership positions identified';
  if (analysis.leadershipNeeds.length > 0) {
    const uniqueLeadership = analysis.leadershipNeeds.reduce((acc, item) => {
      const key = `${item.squad} - ${item.position}`;
      if (!acc.find(x => `${x.squad} - ${x.position}` === key)) {
        acc.push(item);
      }
      return acc;
    }, []);
    
    leadershipText = uniqueLeadership
      .map(item => `• **${item.squad}** - ${item.position}`)
      .join('\n');
  }
  
  // Debug logging
  console.log('Squad data:', analysis.squadData);
  console.log('Leadership needs:', analysis.leadershipNeeds);

  await interaction.reply({
    content: `**1A Recruitment Message**
        
1A is a MILSIM unit modeled after the **75th Ranger Regiment** during the **Global War on Terror**, specifically around the **2009 era**. We emphasize tight coordination, disciplined operations, and high standards — without unnecessary roleplay.
        
📘 More info: https://1a75.org/about
📝 Apply here: https://1a75.org/apply (login via Discord)
💬 Join our Discord: https://discord.gg/RAQwxfbu5H

**Event Times:**
**Friday:** 8 PM EST | <t:1747699200:t>\n\n**Saturday:** 8 PM EST | <t:1747699200:t>

**🎯 We are currently looking to fill:**
${openSquadsText}

**👑 Leadership Positions Needed:**
${leadershipText}
        
**📋 Open MOS's (refer to the perstat for roles):**
${availableRolesText}`,
    ephemeral: false,
  });
}
