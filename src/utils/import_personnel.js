import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { getDatabase } from "../bot/utils/database.js"; // adjust as needed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, "personnel.csv");
const csv = fs.readFileSync(csvPath, "utf8");
const rows = parse(csv, { relax_column_count: true });

const db = getDatabase();

function addPerson({ position, callsign, status, name, platoon, squad }) {
	db.prepare(`
    INSERT INTO personnel (position, callsign, status, name, platoon, squad)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(position, callsign, status, name, platoon, squad);
}

let currentPlatoon = "";
let currentSquad = "";

// Helper: skip header/empty/junk rows
function isHeaderOrJunk(val) {
	if (!val) return true;
	const v = val.trim().toLowerCase();
	return (
		v === "" ||
		v === "position" ||
		v === "callsign" ||
		v === "status" ||
		v === "name" ||
		v === "role/mos" ||
		v === "—" ||
		v.length === 1 // single letter
	);
}

// Helper: detect section headers
function parseSectionHeader(text) {
	if (!text) return { platoon: null, squad: null };
	let platoon = null;
	let squad = null;
	if (text.match(/Platoon/i)) {
		const match = text.match(/(\d+.. Platoon)/i);
		if (match) platoon = match[1];
	}
	if (text.match(/Squad/i)) {
		const match = text.match(/(\d+.. Squad.*?)(?:\s*\(|$)/i);
		if (match) squad = match[1];
	}
	if (!platoon && text.match(/Company|Headquarters/i)) {
		platoon = text.trim();
	}
	return { platoon, squad };
}

for (const row of rows) {
	// Check for section headers (e.g. "1st Platoon, Alpha Company", "Alpha Company Headquarters", etc.)
	for (const cell of row) {
		if (
			cell?.trim() &&
			(cell.includes("Platoon") ||
				cell.includes("Company") ||
				cell.includes("Squad") ||
				cell.includes("Headquarters"))
		) {
			const { platoon, squad } = parseSectionHeader(cell.trim());
			if (platoon) currentPlatoon = platoon;
			if (squad) currentSquad = squad;
			if (platoon && !squad) currentSquad = "";
		}
	}

	// For each row, scan for every set of [Position, Callsign, Status, Name]
	for (let i = 0; i < row.length - 3; i++) {
		const position = row[i]?.trim();
		const callsign = row[i + 1]?.trim();
		const status = row[i + 2]?.replace(/<[^>]+>/g, "").trim();
		const name = row[i + 3]?.trim();

		// Only process if position is not a header/junk and at least one of the fields is not empty
		if (
			isHeaderOrJunk(position) ||
			isHeaderOrJunk(callsign) ||
			isHeaderOrJunk(status) ||
			isHeaderOrJunk(name)
		)
			continue;

		// Only import if name is at least 3 characters and contains a period (e.g. "J. Smith")
		if (!name || name.length < 3 || !name.includes(".")) continue;

		addPerson({
			position,
			callsign,
			status,
			name,
			platoon: currentPlatoon,
			squad: currentSquad,
		});
		console.log(
			`Added: ${position} | ${callsign} | ${status} | ${name} | ${currentPlatoon} | ${currentSquad}`,
		);
	}
}