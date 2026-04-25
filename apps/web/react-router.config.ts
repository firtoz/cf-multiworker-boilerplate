import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	future: {
		/** Vite 7 environment API — required for Alchemy Cloudflare React Router plugin. */
		v8_viteEnvironmentApi: true,
	},
} satisfies Config;
