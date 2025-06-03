import express from "express";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import fs from "node:fs";
import connectSqlite3 from "connect-sqlite3";
import { setupDatabase, getDatabase } from "../bot/utils/database.js";
import passport from "./middleware/passport.js";
import routes from "./routes/index.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "../../events.db");
const SQLiteStore = connectSqlite3(session);

await setupDatabase();

const app = express();
app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(
	session({
		store: new SQLiteStore({ db: "sessions.sqlite" }),
		secret: process.env.SESSION_SECRET,
		resave: false,
		saveUninitialized: false,
		cookie: { secure: true },
	}),
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// Mount all routes
app.use("/", routes);

async function start() {
	if (!fs.existsSync(dbPath)) {
		console.error("Database file not found:", dbPath);
		process.exit(1);
	}
	await getDatabase(); // Ensure DB is ready
	app.listen(process.env.PORT, "127.0.0.1", () => {
		console.log(`Dashboard running at http://127.0.0.1:${process.env.PORT}`);
	});
}

start();
