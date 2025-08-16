#!/usr/bin/env node

/**
 * Standalone script to clean up orphaned users from the events database
 * Usage: node scripts/cleanup-orphaned-users.js [--dry-run]
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { runCleanup } from '../src/bot/utils/cleanup-orphaned-users.js';
import { setupDatabase } from '../src/bot/utils/database.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Orphaned User Cleanup Script

Usage: node scripts/cleanup-orphaned-users.js [options]

Options:
  --dry-run, -d    Show what would be removed without actually removing anything
  --help, -h       Show this help message

Examples:
  node scripts/cleanup-orphaned-users.js --dry-run
  node scripts/cleanup-orphaned-users.js
`);
  process.exit(0);
}

async function main() {
  console.log('=== Orphaned User Cleanup Script ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will remove data)'}`);
  console.log('');
  
  // Setup database
  try {
    setupDatabase();
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Failed to setup database:', error.message);
    process.exit(1);
  }
  
  // Check for required environment variables
  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN environment variable is required');
    process.exit(1);
  }
  
  // Create Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
  });
  
  try {
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected to Discord');
    
    // Wait a moment for the client to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run the cleanup
    const result = await runCleanup(client, dryRun);
    
    if (result.success) {
      console.log('');
      console.log('=== Final Summary ===');
      console.log(`✅ Valid users in server: ${result.validUsersCount}`);
      console.log(`🗑️ Orphaned users found: ${result.orphanedUsers.length}`);
      
      if (dryRun) {
        console.log(`📋 Records that would be removed: ${result.removedCount}`);
        console.log('');
        console.log('💡 To actually remove the data, run without --dry-run flag');
      } else {
        console.log(`🗑️ Total records removed: ${result.removedCount}`);
      }
      
      if (result.orphanedUsers.length > 0) {
        console.log('');
        console.log('Orphaned user IDs:');
        result.orphanedUsers.forEach(userId => console.log(`  - ${userId}`));
      } else {
        console.log('');
        console.log('🎉 No orphaned users found! Database is clean.');
      }
    } else {
      console.error('❌ Cleanup failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ An error occurred:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    client.destroy();
    console.log('');
    console.log('✅ Cleanup complete');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️ Process interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Process terminated');
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
