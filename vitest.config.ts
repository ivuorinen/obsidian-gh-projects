import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
	resolve: {
		alias: {
			obsidian: resolve(__dirname, "tests/__mocks__/obsidian.ts"),
		},
	},
	test: {
		globals: true,
		setupFiles: ["tests/setup.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/main.ts", "src/settings.ts"],
		},
	},
});
