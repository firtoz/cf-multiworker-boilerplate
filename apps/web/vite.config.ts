import * as fs from "node:fs";
import * as path from "node:path";
import type { PluginConfig } from "@cloudflare/vite-plugin";
import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type Plugin, type UserConfig } from "vite";
import { imagetools } from "vite-imagetools";
import devtoolsJson from "vite-plugin-devtools-json";
import tsconfigPaths from "vite-tsconfig-paths";

type AuxiliaryWorkerConfig = Exclude<PluginConfig["auxiliaryWorkers"], undefined>[number];

// Wrap plugins to only apply to specific environments (client and ssr)
// This prevents react-router plugin from running on auxiliary worker environments
const limitToMainEnvironments = (plugins: Plugin | Plugin[]): Plugin[] => {
	const pluginArray = Array.isArray(plugins) ? plugins : [plugins];
	return pluginArray.map((plugin) => ({
		...plugin,
		applyToEnvironment(environment: { name: string }) {
			return environment.name === "client" || environment.name === "ssr";
		},
	}));
};

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

export default defineConfig(({ mode }) => {
	// Type assertion needed due to exactOptionalPropertyTypes incompatibility with plugin types
	return {
		define: {
			"process.env.NODE_ENV": JSON.stringify(mode),
		},
		plugins: [
			devtoolsJson(),
			cloudflare({
				configPath: "./wrangler.jsonc",
				viteEnvironment: { name: "ssr" },
				auxiliaryWorkers: auxiliaryWorkerConfigs,
			}),
			tailwindcss(),
			// Limit react-router plugin to client/ssr environments only
			// Prevents it from running on auxiliary Durable Object worker environments
			...limitToMainEnvironments(reactRouter()),
			tsconfigPaths(),
			imagetools({
				include: "**/*.{heif,avif,jpeg,jpg,png,tiff,webp,gif,svg}?*",
				exclude: [],
			}),
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
							if (id.includes("zod")) {
								return "vendor-zod";
							}
							if (id.includes("@firtoz/hono-fetcher")) {
								return "vendor-hono";
							}
							if (id.includes("clsx") || id.includes("tailwind-merge")) {
								return "vendor-utils";
							}
							// Default vendor chunk
							return "vendor";
						}
					},
					experimentalMinChunkSize: 1000, // Prevent too many tiny chunks
				},
			},
		},
		// Modern build optimizations
		optimizeDeps: {
			include: ["react", "react-dom", "react-router"],
			exclude: [],
		},
	} as UserConfig;
});
