import * as fs from "node:fs";
import * as path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import type { PluginConfig } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

type AuxiliaryWorkerConfig = Exclude<PluginConfig["auxiliaryWorkers"], undefined>[number];

// Find all wrangler.jsonc files in the durable-objects directory
const durableObjectsDir = path.resolve(__dirname, "../../durable-objects");
const findWranglerConfigs = (): AuxiliaryWorkerConfig[] => {
	if (!fs.existsSync(durableObjectsDir)) {
		return [];
	}

	// Get all subdirectories of the durable-objects directory
	const subdirs = fs
		.readdirSync(durableObjectsDir, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	// Check each subdirectory for a wrangler.jsonc file
	return subdirs
		.map((subdir): AuxiliaryWorkerConfig | null => {
			const configPath = path.join("../../durable-objects", subdir, "wrangler.jsonc");
			const fullPath = path.resolve(durableObjectsDir, subdir, "wrangler.jsonc");

			return fs.existsSync(fullPath) ? { configPath } : null;
		})
		.filter((config) => config !== null); // Type guard to remove null entries
};

const auxiliaryWorkerConfigs = findWranglerConfigs();

console.log("auxiliaryWorkerConfigs", auxiliaryWorkerConfigs);

export default defineConfig({
	plugins: [
		cloudflare({
			configPath: "./wrangler.dev.json",
			viteEnvironment: { name: "ssr" },
			auxiliaryWorkers: auxiliaryWorkerConfigs,
		}),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
	],
});
