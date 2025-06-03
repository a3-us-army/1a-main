// registerCommandsManually.js
import dotenv from "dotenv";
import { registerCommands } from "./utils/commandRegistration.js";

dotenv.config();

(async () => {
	console.log("Manually registering commands...");
	await registerCommands();
	console.log("Commands registered successfully!");
	process.exit(0);
})();
