// commands/textEval.js
import { inspect } from "node:util";

/**
 * Handles the eval command triggered by mentioning the bot
 * @param {Message} message - The message that triggered the command
 * @param {string} code - The code to evaluate
 */
export async function handleEval(message, code) {
	// Get the bot owner ID from environment variables
	const ownerId = process.env.OWNER_ID;

	// Check if the user is the bot owner
	if (message.author.id !== ownerId) {
		return message.reply("This command can only be used by the bot owner.");
	}

	try {
		// Create a context with useful variables
		const client = message.client;
		const guild = message.guild;
		const channel = message.channel;

		// Execute the code
		// biome-ignore lint/security/noGlobalEval: <explanation>
		let result = eval(code);

		// Handle promises
		if (result instanceof Promise) {
			result = await result;
		}

		// Convert result to string with proper formatting
		let output = inspect(result, { depth: 0 });

		// Truncate if too long
		if (output.length > 1990) {
			output = `${output.substring(0, 1990)}... (truncated)`;
		}

		// Just send the output as a code block
		await message.reply(`\`\`\`js\n${output}\n\`\`\``);
	} catch (error) {
		// Send error as a code block
		await message.reply(`\`\`\`js\n${error.message}\n\`\`\``);
	}
}
