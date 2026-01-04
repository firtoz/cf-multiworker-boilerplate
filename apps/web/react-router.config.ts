import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	future: {
		// Enable Vite 7 environment API for better performance
		v8_viteEnvironmentApi: true,
	},
} satisfies Config;
