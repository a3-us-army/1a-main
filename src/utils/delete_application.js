import { getDatabase } from "../bot/utils/database.js"; // Adjust path as needed

// Replace this with the user ID you want to delete
const userIdToDelete = "829909201262084096";

const db = getDatabase();

const result = db
	.prepare("DELETE FROM applications WHERE user_id = ?")
	.run(userIdToDelete);

console.log(
	`Deleted ${result.changes} Application for user ID: ${userIdToDelete}`,
);

db.prepare("DELETE FROM applications WHERE id IS NULL").run();
console.log("Deleted all applications with id = NULL");