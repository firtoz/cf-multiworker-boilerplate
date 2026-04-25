import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import alchemy from "alchemy/cloudflare/react-router";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type PluginOption, type UserConfig } from "vite";
import { imagetools } from "vite-imagetools";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig((configEnv) => {
	const { mode } = configEnv;

	return {
		define: {
			"process.env.NODE_ENV": JSON.stringify(mode),
		},
		server: {
			host: true,
		},
		plugins: [
			devtoolsJson(),
			alchemy() as PluginOption,
			tailwindcss(),
			reactRouter(),
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
			sourcemap: false,
		},
		optimizeDeps: {
			include: ["react", "react-dom", "react-router"],
			exclude: [],
		},
		resolve: {
			// Rolldown (Vite 8 production build) does not apply tsconfigPaths the same as esbuild dev;
			// explicit alias matches apps/web/tsconfig.cloudflare.json paths "~/*" -> "./app/*".
			alias: {
				"~": fileURLToPath(new URL("./app", import.meta.url)),
			},
			tsconfigPaths: true,
		},
	} as UserConfig;
});
