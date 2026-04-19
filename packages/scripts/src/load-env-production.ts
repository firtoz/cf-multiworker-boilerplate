import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

export const PROD_ENV_BASENAME = ".env.production";

/** Repo root (`packages/scripts/src` → three levels up). */
export function getRepoRoot(): string {
	return path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..", "..");
}

function printMissingProdEnvFile(prodPath: string, repoRoot: string): void {
	console.error("");
	console.error("  Prod deploy prerequisite failed: missing repo-root .env.production");
	console.error("");
	console.error(`  Expected file: ${prodPath}`);
	console.error("");
	console.error("  What will NOT work until this file exists:");
	console.error("    • bun run deploy / deploy:execute (root package.json)");
	console.error("    • scripts#sync-secrets:prod, scripts#pre-deploy, and downstream Turbo tasks");
	console.error(
		"    • Loading production secrets / CLI auth from .env.local — that file is for local dev only.",
	);
	console.error("");
	console.error("  What to do:");
	console.error(
		`    1. Create ${PROD_ENV_BASENAME} at the repository root (same folder as package.json).`,
	);
	console.error("    2. Easiest: run `bun run setup:prod` (interactive wizard).");
	console.error(
		"       Required: SESSION_SECRET. CLOUDFLARE_* optional if you use `bunx wrangler login`. See README for the full list.",
	);
	console.error("       Add WEB_* / ROUTES* keys your wrangler templates need.");
	console.error(`    3. Re-run your command from the repo root (cwd must be ${repoRoot}).`);
	console.error("");
}

/** Fail fast with the same message as loadEnvProductionStrict when the file is missing (no dotenv load). */
export function checkProdDeployPrereqs(): void {
	const repoRoot = getRepoRoot();
	const prodPath = path.join(repoRoot, PROD_ENV_BASENAME);
	if (!fs.existsSync(prodPath)) {
		printMissingProdEnvFile(prodPath, repoRoot);
		process.exit(1);
	}
}

/**
 * Live deploy / prod tooling: require repo-root `.env.production`, load it, and exit if missing.
 * Does not read `.env.local`. Uses `override: true` so file contents win over inherited env.
 */
export function loadEnvProductionStrict(): void {
	const repoRoot = getRepoRoot();
	const prodPath = path.join(repoRoot, PROD_ENV_BASENAME);
	if (!fs.existsSync(prodPath)) {
		printMissingProdEnvFile(prodPath, repoRoot);
		process.exit(1);
	}
	config({ path: prodPath, override: true });
}
