import { getDatabase } from './database.js';

/**
 * Script to check for and remove orphaned users from the events database
 * This finds users who are no longer in the Discord server and removes their data
 * (excluding applications as requested)
 */

export async function cleanupOrphanedUsers(discordClient, dryRun = false) {
  const db = getDatabase();
  
  console.log(`Starting orphaned user cleanup${dryRun ? ' (DRY RUN)' : ''}...`);
  console.log('Database connection established');
  
  // Check if we can actually query the database
  try {
    const testQuery = db.prepare('SELECT 1 as test').get();
    console.log('Database connection test:', testQuery);
  } catch (error) {
    console.error('Database connection test failed:', error);
    return {
      success: false,
      error: 'Database connection failed'
    };
  }
  
  try {
    // Get all unique user IDs from the database
    const allUserIds = new Set();
    
    // First, let's see what tables exist in the database
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Available tables in database:', tables.map(t => t.name));
    
    // Get users from rsvps table
    const totalRsvps = db.prepare('SELECT COUNT(*) as count FROM rsvps').get();
    const rsvpUsers = db.prepare('SELECT DISTINCT user_id FROM rsvps').all();
    console.log(`Found ${rsvpUsers.length} unique users in rsvps table (from ${totalRsvps.count} total RSVP records)`);
    rsvpUsers.forEach(row => allUserIds.add(row.user_id));
    
    // Get users from users table
    const dbUsers = db.prepare('SELECT id FROM users').all();
    console.log(`Found ${dbUsers.length} users in users table`);
    dbUsers.forEach(row => allUserIds.add(row.id));
    
    // Get users from loa_requests table
    const loaUsers = db.prepare('SELECT DISTINCT user_id FROM loa_requests').all();
    console.log(`Found ${loaUsers.length} users in loa_requests table`);
    if (loaUsers.length > 0) {
      console.log('LOA users:', loaUsers.map(r => r.user_id));
    }
    loaUsers.forEach(row => allUserIds.add(row.user_id));
    
    // Get users from staff_profiles table
    const staffUsers = db.prepare('SELECT DISTINCT user_id FROM staff_profiles').all();
    console.log(`Found ${staffUsers.length} users in staff_profiles table`);
    if (staffUsers.length > 0) {
      console.log('Staff users:', staffUsers.map(r => r.user_id));
    }
    staffUsers.forEach(row => allUserIds.add(row.user_id));
    
    // Check if there are any other tables that might contain user IDs
    const userRelatedTables = tables.filter(t => 
      t.name.toLowerCase().includes('user') || 
      t.name.toLowerCase().includes('member') ||
      t.name.toLowerCase().includes('profile') ||
      t.name.toLowerCase().includes('application')
    );
    
    console.log('User-related tables found:', userRelatedTables.map(t => t.name));
    
    // Check applications table (we don't remove these, but let's see how many users are there)
    try {
      const appUsers = db.prepare('SELECT DISTINCT user_id FROM applications').all();
      console.log(`Found ${appUsers.length} users in applications table (not removing these)`);
    } catch (error) {
      console.log('Applications table not found or no user_id column');
    }
    
    // Check events table for creator_id
    try {
      const eventCreators = db.prepare('SELECT DISTINCT creator_id FROM events WHERE creator_id IS NOT NULL').all();
      console.log(`Found ${eventCreators.length} event creators in events table`);
      if (eventCreators.length > 0) {
        console.log('Event creators:', eventCreators.map(r => r.creator_id));
        eventCreators.forEach(row => allUserIds.add(row.creator_id));
      }
    } catch (error) {
      console.log('Events table not found or no creator_id column');
    }
    
    // Check equipment_requests table for requested_by
    try {
      const equipmentRequesters = db.prepare('SELECT DISTINCT requested_by FROM equipment_requests WHERE requested_by IS NOT NULL').all();
      console.log(`Found ${equipmentRequesters.length} equipment requesters`);
      if (equipmentRequesters.length > 0) {
        console.log('Equipment requesters:', equipmentRequesters.map(r => r.requested_by));
        equipmentRequesters.forEach(row => allUserIds.add(row.requested_by));
      }
    } catch (error) {
      console.log('Equipment_requests table not found or no requested_by column');
    }
    
    console.log(`Found ${allUserIds.size} unique users in database total`);
    console.log('All unique user IDs found:', Array.from(allUserIds));
    
    // Check which users are still in the Discord server
    const orphanedUsers = [];
    const validUsers = [];
    
    // Get the specific guild to check against
    const guildId = '1332773894293160039';
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      console.error(`Guild with ID ${guildId} not found in Discord client`);
      return {
        success: false,
        error: `Guild with ID ${guildId} not found`
      };
    }
    
    console.log(`Checking users against guild: ${guild.name} (${guild.id})`);
    console.log(`Guild member count: ${guild.memberCount}`);
    console.log(`Guild members cached: ${guild.members.cache.size}`);
    
    // Try to fetch all members if the cache is small
    if (guild.members.cache.size < guild.memberCount * 0.8) {
      console.log('Fetching all guild members...');
      try {
        await guild.members.fetch();
        console.log(`After fetch: ${guild.members.cache.size} members cached`);
      } catch (error) {
        console.error('Error fetching guild members:', error.message);
      }
    }
    
    let checkedCount = 0;
    for (const userId of allUserIds) {
      checkedCount++;
      if (checkedCount % 10 === 0) {
        console.log(`Checked ${checkedCount}/${allUserIds.size} users...`);
      }
      
      try {
        // First check if the member is already cached
        let member = guild.members.cache.get(userId);
        
        if (!member) {
          // If not cached, try to fetch from Discord API
          member = await guild.members.fetch(userId);
        }
        
        if (member) {
          validUsers.push(userId);
        }
      } catch (error) {
        // If we can't fetch the member, they're likely not in the server anymore
        if (error.code === 10007) { // Unknown Member error
          orphanedUsers.push(userId);
        } else {
          console.error(`Error checking user ${userId}:`, error.message);
        }
      }
    }
    
    console.log(`Finished checking ${checkedCount} users`);
    
    console.log(`Found ${validUsers.length} valid users still in server`);
    console.log(`Found ${orphanedUsers.length} orphaned users to remove`);
    
    if (orphanedUsers.length === 0) {
      console.log('No orphaned users found. Database is clean!');
      return {
        success: true,
        orphanedUsers: [],
        removedCount: 0,
        validUsersCount: validUsers.length
      };
    }
    
    // Remove orphaned users from database (excluding applications as requested)
    let totalRemoved = 0;
    
    for (const userId of orphanedUsers) {
      try {
        if (dryRun) {
          // Count what would be removed without actually removing
          const rsvpCount = db.prepare('SELECT COUNT(*) as count FROM rsvps WHERE user_id = ?').get(userId).count;
          const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE id = ?').get(userId).count;
          const loaCount = db.prepare('SELECT COUNT(*) as count FROM loa_requests WHERE user_id = ?').get(userId).count;
          const staffCount = db.prepare('SELECT COUNT(*) as count FROM staff_profiles WHERE user_id = ?').get(userId).count;
          
          const userTotal = rsvpCount + userCount + loaCount + staffCount;
          totalRemoved += userTotal;
          
          console.log(`Would remove user ${userId}: ${rsvpCount} RSVPs, ${userCount} user record, ${loaCount} LOA requests, ${staffCount} staff profiles`);
        } else {
          // Actually remove the data
          const rsvpResult = db.prepare('DELETE FROM rsvps WHERE user_id = ?').run(userId);
          const userResult = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
          const loaResult = db.prepare('DELETE FROM loa_requests WHERE user_id = ?').run(userId);
          const staffResult = db.prepare('DELETE FROM staff_profiles WHERE user_id = ?').run(userId);
          
          const userTotal = rsvpResult.changes + userResult.changes + loaResult.changes + staffResult.changes;
          totalRemoved += userTotal;
          
          console.log(`Removed user ${userId}: ${rsvpResult.changes} RSVPs, ${userResult.changes} user record, ${loaResult.changes} LOA requests, ${staffResult.changes} staff profiles`);
        }
        
      } catch (error) {
        console.error(`Error ${dryRun ? 'checking' : 'removing'} orphaned user ${userId}:`, error.message);
      }
    }
    
    console.log(`Cleanup complete! ${dryRun ? 'Would remove' : 'Removed'} ${totalRemoved} total records for ${orphanedUsers.length} orphaned users`);
    
    return {
      success: true,
      orphanedUsers,
      removedCount: totalRemoved,
      validUsersCount: validUsers.length
    };
    
  } catch (error) {
    console.error('Error during orphaned user cleanup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Standalone function to run the cleanup (for manual execution)
 */
export async function runCleanup(discordClient, dryRun = false) {
  console.log('=== Orphaned User Cleanup Script ===');
  console.log('This script will remove users who are no longer in the Discord server');
  console.log('Applications will be preserved as requested');
  console.log('');
  
  const result = await cleanupOrphanedUsers(discordClient, dryRun);
  
  if (result.success) {
    console.log('');
    console.log('=== Cleanup Summary ===');
    console.log(`Valid users in server: ${result.validUsersCount}`);
    console.log(`Orphaned users found: ${result.orphanedUsers.length}`);
    console.log(`Total records ${dryRun ? 'that would be removed' : 'removed'}: ${result.removedCount}`);
    
    if (result.orphanedUsers.length > 0) {
      console.log('');
      console.log('Orphaned user IDs:');
      result.orphanedUsers.forEach(userId => console.log(`  - ${userId}`));
    }
  } else {
    console.error('Cleanup failed:', result.error);
  }
  
  return result;
}
