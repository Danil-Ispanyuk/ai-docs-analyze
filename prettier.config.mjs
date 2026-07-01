/** @type {import("prettier").Config} */
const config = {
	useTabs: true,
	tabWidth: 2,
	printWidth: 100,
	semi: true,
	singleQuote: false,
	trailingComma: "all",
	plugins: ["prettier-plugin-tailwindcss"],
	// Tailwind v4: point the plugin at the CSS entry so class sorting is accurate.
	tailwindStylesheet: "./src/app/globals.css",
	// Also sort classes passed to cn(...).
	tailwindFunctions: ["cn"],
};

export default config;
