module.exports = {
	apps: [
		{
			name: "website",
			script: "./src/website/app.js",
			watch: false,
			env: {
				NODE_ENV: "production",
			},
		},
		{
			name: "bot/API",
			script: "./src/bot/main.js",
			watch: false,
			env: {
				NODE_ENV: "production",
			},
		},
	],
};
