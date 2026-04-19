#!/usr/bin/env bun
/**
 * Turbo task `wrangler:dry-run:prod`: `wrangler deploy --dry-run` per Worker (no live deploy).
 *
 * - Durable Object packages use `-c wrangler-prod.jsonc` (from `generate-wrangler:prod`).
 * - Web uses `build/server/wrangler.json` from `react-router build` + `@cloudflare/vite-plugin`.
 *
 * Depends on `cf-starter-web#build:prod` so the server bundle and generated prod wranglers exist.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const durableObjectRelDirs = [
	"durable-objects/example-do",
	"durable-objects/coordinator-do",
	"durable-objects/processor-do",
] as const;

for (const rel of durableObjectRelDirs) {
	const cwd = path.join(repoRoot, rel);
	const wranglerProd = path.join(cwd, "wrangler-prod.jsonc");
	if (!existsSync(wranglerProd)) {
		console.error(
			`Missing ${rel}/wrangler-prod.jsonc. Run generate-wrangler:prod (e.g. via typegen:prod or build:prod).`,
		);
		process.exit(1);
	}
	console.log(`  ${rel}: wrangler deploy --dry-run -c wrangler-prod.jsonc`);
	const r = await $`bunx wrangler deploy --dry-run -c wrangler-prod.jsonc`.cwd(cwd).nothrow();
	if (r.exitCode !== 0) {
		console.error(`  wrangler --dry-run failed for ${rel} (exit ${r.exitCode}).`);
		process.exit(r.exitCode ?? 1);
	}
}

const webDir = path.join(repoRoot, "apps/web");
const webBuiltWrangler = path.join(webDir, "build/server/wrangler.json");
if (!existsSync(webBuiltWrangler)) {
	console.error(
		"apps/web: missing build/server/wrangler.json. Run cf-starter-web#build:prod first (e.g. `turbo run build:prod --filter=cf-starter-web`).",
	);
	process.exit(1);
}

console.log("  apps/web: wrangler deploy --dry-run -c build/server/wrangler.json");
const webResult = await $`bunx wrangler deploy --dry-run -c build/server/wrangler.json`
	.cwd(webDir)
	.nothrow();
if (webResult.exitCode !== 0) {
	console.error(`  wrangler --dry-run failed for apps/web (exit ${webResult.exitCode}).`);
	process.exit(webResult.exitCode ?? 1);
}

console.log("\nwrangler:dry-run:prod — ok\n");
process.exit(0);
