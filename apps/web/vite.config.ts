import * as fs from "node:fs";
import * as path from "node:path";
import type { PluginConfig } from "@cloudflare/vite-plugin";
import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import tsconfigPaths from "vite-tsconfig-paths";
import { visualizer } from "rollup-plugin-visualizer";

type AuxiliaryWorkerConfig = Exclude<PluginConfig["auxiliaryWorkers"], undefined>[number];

// Find all wrangler.jsonc files in the durable-objects directory.
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

export default defineConfig({
	plugins: [
		devtoolsJson(),
		cloudflare({
			configPath: "./wrangler.jsonc",
			viteEnvironment: { name: "ssr" },
			auxiliaryWorkers: auxiliaryWorkerConfigs,
		}),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
		visualizer({
			filename: "build/stats.html",
			open: false,
			gzipSize: true,
			brotliSize: true,
		}),
	],
	build: {
		cssCodeSplit: true,
		minify: "esbuild",
		target: "esnext",
		sourcemap: false, // Disable source maps in production
		rollupOptions: {
			output: {
				// Removed experimentalMinChunkSize - it was merging chunks into entry.client
				manualChunks: (id) => {
					// Aggressive vendor splitting for better caching and parallel loads
					if (id.includes("node_modules")) {
						// Split out heavy libraries
						if (id.includes("zod")) return "vendor-zod";
						if (id.includes("@firtoz/hono-fetcher")) return "vendor-hono";
						if (id.includes("clsx") || id.includes("tailwind-merge")) return "vendor-utils";
						// Default vendor chunk
						return "vendor";
					}
				},
			},
		},
	},
});
