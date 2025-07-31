import { getDatabase } from '../bot/utils/database.js'; // Adjust path as needed

// Replace this with the user ID you want to delete
const userIdToDelete = '829909201262084096';

const db = getDatabase();

const result = db
  .prepare('DELETE FROM loa_requests WHERE user_id = ?')
  .run(userIdToDelete);

console.log(
  `Deleted ${result.changes} LOA request(s) for user ID: ${userIdToDelete}`
);
