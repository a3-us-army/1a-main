#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to remove all certificate requests for a user
async function removeAllCertRequests(userId) {
  try {
    // Open the database (assuming it's in the root directory)
    const dbPath = path.join(__dirname, '../../events.db');
    const db = new Database(dbPath);
    
    console.log(`🔍 Looking for certificate requests for user: ${userId}`);
    
    // First, let's see what requests exist for this user
    const existingRequests = db.prepare(`
      SELECT cr.id, cr.status, cr.requested_at, c.name as cert_name
      FROM certification_requests cr
      JOIN certifications c ON cr.cert_id = c.id
      WHERE cr.user_id = ?
      ORDER BY cr.requested_at DESC
    `).all(userId);
    
    if (existingRequests.length === 0) {
      console.log('❌ No certificate requests found for this user.');
      return;
    }
    
    console.log(`📋 Found ${existingRequests.length} certificate request(s):`);
    existingRequests.forEach((req, index) => {
      console.log(`  ${index + 1}. ${req.cert_name} (${req.status}) - Requested: ${req.requested_at}`);
    });
    
    // Ask for confirmation
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\n⚠️  Are you sure you want to delete ALL certificate requests for this user? (yes/no): ', (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        // Delete all certificate requests for the user
        const deleteStmt = db.prepare('DELETE FROM certification_requests WHERE user_id = ?');
        const result = deleteStmt.run(userId);
        
        console.log(`✅ Successfully deleted ${result.changes} certificate request(s) for user ${userId}`);
        
        // Also delete any Discord messages if they exist
        console.log('ℹ️  Note: You may need to manually delete Discord messages in the certification channel.');
      } else {
        console.log('❌ Operation cancelled.');
      }
      
      rl.close();
      db.close();
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Function to remove certificate requests by username (if you have a users table)
async function removeCertRequestsByUsername(username) {
  try {
    const dbPath = path.join(__dirname, 'events.db');
    const db = new Database(dbPath);
    
    console.log(`🔍 Looking for user with username: ${username}`);
    
    // Check if there's a users table and find the user ID
    const user = db.prepare('SELECT id FROM users WHERE username = ? OR discord_username = ?').get(username, username);
    
    if (!user) {
      console.log('❌ User not found. Please provide a valid user ID instead.');
      db.close();
      return;
    }
    
    console.log(`✅ Found user: ${username} (ID: ${user.id})`);
    await removeAllCertRequests(user.id);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node remove-cert-requests.js <user_id_or_username>');
    console.log('');
    console.log('Examples:');
    console.log('  node remove-cert-requests.js 123456789012345678');
    console.log('  node remove-cert-requests.js username#1234');
    console.log('');
    console.log('This script will remove ALL certificate requests for the specified user.');
    process.exit(1);
  }
  
  const userIdentifier = args[0];
  
  // Check if it looks like a Discord user ID (18-19 digits)
  if (/^\d{18,19}$/.test(userIdentifier)) {
    await removeAllCertRequests(userIdentifier);
  } else {
    // Assume it's a username
    await removeCertRequestsByUsername(userIdentifier);
  }
}

// Run the script
main().catch(console.error);

export { removeAllCertRequests, removeCertRequestsByUsername }; 