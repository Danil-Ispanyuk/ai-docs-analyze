import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	// esbuild handles the JSX transform (React 19 automatic runtime), so no
	// @vitejs/plugin-react is needed — avoids a Vite-version clash with Vitest.
	esbuild: {
		jsx: "automatic",
	},
	test: {
		// Node by default (fast). Component tests opt into jsdom via a
		// `// @vitest-environment jsdom` docblock at the top of the file.
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}"],
		setupFiles: ["./vitest.setup.ts"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
});
