/**
 * Single source for setup wizards: which keys are required vs optional, shared copy, and validation.
 * Optional keys are omitted from env files when unused.
 */

/** True if null, undefined, or only whitespace. */
export function isUnset(value: string | null | undefined): boolean {
	if (value == null) {
		return true;
	}
	return value.trim() === "";
}

export const LOCAL_SETUP_BANNER = {
	title: "Local — .env.local",
	required: [
		"SESSION_SECRET — required for signed cookies / sessions in the web worker (setup can generate one).",
	],
	optional: [
		"CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — omit if you use `bunx wrangler login` (OAuth); add for CI or token-based tooling.",
		"WEB_* worker names — omit to use built-in cf-*-dev names from generate-wrangler.",
	],
} as const;

export const PROD_SETUP_BANNER = {
	title: "Production — .env.production",
	required: [
		"SESSION_SECRET — required for web sessions and secret-sync tooling (setup can generate one).",
		"Template-required secrets — any name listed in wrangler `secrets.required` must have a real value here (for `sync-secrets:prod`).",
	],
	optional: [
		"CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — omit if you use `bunx wrangler login` on this machine; Wrangler uses OAuth. Add both for CI or API-token-only flows.",
		"ROUTES / ROUTES_ZONE_NAME — omit unless you use custom domains (otherwise workers.dev / defaults apply).",
		"WEB_* worker names — omit to use template defaults (cf-web-app, cf-example-do, …) from generate-wrangler.",
	],
} as const;

export const CF_WRANGLER_LOGIN_EXPLAINER = `Wrangler can use OAuth from \`bunx wrangler login\` instead of putting an API token or account ID in this file. If you skip those vars here, run \`bunx wrangler login\` before deploy — that is enough for local CLI auth.`;

export function formatBanner(banner: typeof LOCAL_SETUP_BANNER | typeof PROD_SETUP_BANNER): string {
	const req = banner.required.map((line) => `    • ${line}`).join("\n");
	const opt = banner.optional.map((line) => `    • ${line}`).join("\n");
	return `  ${banner.title}\n\n  ${"Required:"}\n${req}\n\n  ${"Optional (omit from file if unused):"}\n${opt}\n`;
}

/** Shape expected by prod setup validation (avoid importing bootstrap from here). */
export type ProdAnswersForValidation = {
	sessionSecret: string;
	extraSecrets: Record<string, string | null>;
};

/**
 * Missing values for names in wrangler `secrets.required`.
 * `SESSION_SECRET` is satisfied by the top-level SESSION_SECRET line, not `extraSecrets`.
 */
export function missingRequiredProdSecrets(
	a: ProdAnswersForValidation,
	discovered: string[],
): string[] {
	const missing: string[] = [];
	for (const name of discovered) {
		if (name === "SESSION_SECRET") {
			if (isUnset(a.sessionSecret)) {
				missing.push(name);
			}
			continue;
		}
		const v = a.extraSecrets[name];
		if (isUnset(v)) {
			missing.push(name);
		}
	}
	return missing;
}
