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

type AuxiliaryWorkerConfig = Exclude<PluginConfig["auxiliaryWorkers"], undefined>[number];

/** `build:prod` sets `WRANGLER_CONFIG_FILE=./wrangler-prod.jsonc`; dev defaults to wrangler-dev.jsonc. */
const wranglerMainConfigPath = process.env["WRANGLER_CONFIG_FILE"] ?? "./wrangler-dev.jsonc";

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
const findWranglerConfigsForDev = (): AuxiliaryWorkerConfig[] => {
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
			const configPath = path.join("../../durable-objects", subdir, "wrangler-dev.jsonc");
			const fullPath = path.resolve(durableObjectsDir, subdir, "wrangler-dev.jsonc");

			if (!fs.existsSync(fullPath)) {
				return null;
			}

			// Check if this DO has its own dev script (should be run independently)
			const packageJsonPath = path.resolve(durableObjectsDir, subdir, "package.json");
			if (fs.existsSync(packageJsonPath)) {
				try {
					const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
					if (packageJson.scripts?.dev) {
						console.log(`[vite] Skipping ${subdir} (has own dev script)`);
						return null;
					}
				} catch (err) {
					console.warn(`[vite] Failed to parse ${packageJsonPath}:`, err);
				}
			}

			return { configPath };
		})
		.filter((config) => config !== null); // Type guard to remove null entries
};

export default defineConfig((configEnv) => {
	const { command, mode } = configEnv;
	const auxiliaryWorkerConfigs: AuxiliaryWorkerConfig[] =
		command === "serve" ? findWranglerConfigsForDev() : [];

	// Type assertion needed due to exactOptionalPropertyTypes incompatibility with plugin types
	return {
		define: {
			"process.env.NODE_ENV": JSON.stringify(mode),
		},
		plugins: [
			devtoolsJson(),
			cloudflare({
				configPath: wranglerMainConfigPath,
				viteEnvironment: { name: "ssr" },
				auxiliaryWorkers: auxiliaryWorkerConfigs,
			}),
			tailwindcss(),
			// Limit react-router plugin to client/ssr environments only
			// Prevents it from running on auxiliary Durable Object worker environments
			// @react-router/dev resolves Vite from its own nested dependency; types differ from hoisted vite.
			...(limitToMainEnvironments(reactRouter() as unknown as Plugin) as Plugin[]),
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
		},
		// Modern build optimizations
		optimizeDeps: {
			include: ["react", "react-dom", "react-router"],
			exclude: [],
		},
		resolve: {
			tsconfigPaths: true,
		},
	} as UserConfig;
});
