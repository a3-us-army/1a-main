import fs from "node:fs";
import path from "node:path";

// Directory to search (change if needed)
const TARGET_DIR = path.join(process.cwd(), "src/commands/events");

function fixFile(filePath) {
	let content = fs.readFileSync(filePath, "utf8");
	const regex = /new Date\(event\.time\)\.toLocaleString\(\)/g;
	const replacement = "`<t:${event.time}:F> (<t:${event.time}:R>)`";
	if (regex.test(content)) {
		content = content.replace(regex, replacement);
		fs.writeFileSync(filePath, content, "utf8");
		console.log(`✅ Fixed: ${filePath}`);
	}
}

function walk(dir) {
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			walk(filePath);
		} else if (file.endsWith(".js")) {
			fixFile(filePath);
		}
	}
}

walk(TARGET_DIR);
console.log("Done! All event date fields have been updated.");
