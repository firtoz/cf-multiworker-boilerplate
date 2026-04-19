/**
 * Single source for setup wizards: which keys are required vs optional, shared copy, and validation.
 * Required secret names come from wrangler `secrets.required` in templates (see discoverSecretsRequiredFromTemplates).
 */
import { discoverSecretsRequiredFromTemplates, getWorkerNameEnvKeys } from "./prod-env-manifest";

/** True if null, undefined, or only whitespace. */
export function isUnset(value: string | null | undefined): boolean {
	if (value == null) {
		return true;
	}
	return value.trim() === "";
}

/** Copy blocks for setup CLI banners (structural type so formatBanner is not a union of tuple literals). */
export type SetupBanner = {
	readonly title: string;
	readonly required: readonly string[];
	readonly optional: readonly string[];
};

function describeLocalRequiredSecret(name: string): string {
	return `${name} — listed in wrangler secrets.required; set a real value for local dev / typegen (setup can generate values where applicable).`;
}

function describeProdRequiredSecret(name: string): string {
	return `${name} — listed in wrangler secrets.required; set in .env.production for sync-secrets:prod / deploy.`;
}

/** Builds the local setup banner from `secrets.required` across all `wrangler.jsonc.hbs` templates. */
export function buildLocalSetupBanner(repoRoot: string): SetupBanner {
	const secrets = discoverSecretsRequiredFromTemplates(repoRoot);
	const required: string[] =
		secrets.length > 0
			? secrets.map(describeLocalRequiredSecret)
			: [
					"No secrets.required entries in wrangler templates under apps/ or durable-objects/ — add secrets in wrangler when your workers need them.",
				];

	const workerKeys = getWorkerNameEnvKeys(repoRoot);
	const workerOptional =
		workerKeys.length > 0
			? `Worker name variables from templates: ${workerKeys.join(", ")} — omit to use generate-wrangler defaults (cf-*-dev).`
			: "Worker name variables — derived from wrangler templates when packages exist.";

	return {
		title: "Local — .env.local",
		required,
		optional: [
			"CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — omit if you use `bunx wrangler login` (OAuth); add for CI or token-based tooling.",
			workerOptional,
		],
	};
}

/** Builds the production setup banner from the same wrangler `secrets.required` discovery. */
export function buildProdSetupBanner(repoRoot: string): SetupBanner {
	const secrets = discoverSecretsRequiredFromTemplates(repoRoot);
	const required: string[] =
		secrets.length > 0
			? secrets.map(describeProdRequiredSecret)
			: [
					"No secrets.required entries in wrangler templates — add secrets in wrangler when your workers need them.",
				];

	const workerKeys = getWorkerNameEnvKeys(repoRoot);
	const workerOptional =
		workerKeys.length > 0
			? `Worker name variables from templates: ${workerKeys.join(", ")} — omit to use generate-wrangler defaults (cf-*).`
			: "Worker name variables — derived from wrangler templates when packages exist.";

	return {
		title: "Production — .env.production",
		required,
		optional: [
			"CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — omit if you use `bunx wrangler login` on this machine; Wrangler uses OAuth. Add both for CI or API-token-only flows.",
			"ROUTES / ROUTES_ZONE_NAME — omit unless you use custom domains (otherwise workers.dev / defaults apply).",
			workerOptional,
		],
	};
}

export const CF_WRANGLER_LOGIN_EXPLAINER = `Wrangler can use OAuth from \`bunx wrangler login\` instead of putting an API token or account ID in this file. If you skip those vars here, run \`bunx wrangler login\` before deploy — that is enough for local CLI auth.`;

export function formatBanner(banner: SetupBanner): string {
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
