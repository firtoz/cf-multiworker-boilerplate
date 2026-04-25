import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

import { runAlchemyStatePasswordPreflight } from "./alchemy-state-password-preflight.js";

const root = resolve(import.meta.dir, "../..");

function readJson(path: string) {
	return JSON.parse(readFileSync(path, "utf8"));
}

/** Bun isolated linker: per-package `node_modules`. Hoisted: most deps at the repo root. */
function firstExistingPackageJson(candidates: string[], what: string) {
	for (const rel of candidates) {
		const p = join(root, rel, "package.json");
		if (existsSync(p)) {
			return realpathSync(p);
		}
	}
	fail(
		`Could not find ${what}. Tried:`,
		candidates.map((c) => join(root, c, "package.json")),
	);
}

function normalizeExactVersion(value: unknown) {
	return typeof value === "string" && /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(value) ? value : null;
}

function fail(message: string, details: string[] = []): never {
	console.error(`\n[dev:preflight] ${message}\n`);
	for (const detail of details) {
		console.error(`  ${detail}`);
	}
	console.error(
		"\nThis dev setup uses cross-worker bindings through Wrangler's local dev registry.",
	);
	console.error("All local Cloudflare runtime packages must agree before `bun run dev` starts.\n");
	process.exit(1);
}

async function main() {
	const rootPackage = readJson(join(root, "package.json"));

	const cfVite = readJson(
		firstExistingPackageJson(
			["apps/web/node_modules/@cloudflare/vite-plugin", "node_modules/@cloudflare/vite-plugin"],
			"@cloudflare/vite-plugin",
		),
	);
	const expectedWrangler = cfVite.dependencies?.wrangler;
	const expectedMiniflare = cfVite.dependencies?.miniflare;

	if (!expectedWrangler || !expectedMiniflare) {
		fail("Could not read @cloudflare/vite-plugin's pinned Wrangler/Miniflare versions.", [
			`@cloudflare/vite-plugin version: ${cfVite.version ?? "unknown"}`,
			"Expected dependencies.wrangler and dependencies.miniflare to be present.",
		]);
	}

	const catalogWrangler = rootPackage.workspaces?.catalog?.wrangler;
	const overrideMiniflare = rootPackage.overrides?.miniflare;

	const catalogWranglerExact = normalizeExactVersion(catalogWrangler);
	if (catalogWranglerExact !== expectedWrangler) {
		fail("Wrangler is not aligned with @cloudflare/vite-plugin.", [
			`@cloudflare/vite-plugin ${cfVite.version} expects wrangler ${expectedWrangler}.`,
			`Root workspaces.catalog.wrangler is ${catalogWrangler ?? "(missing)"}.`,
			`Set package.json workspaces.catalog.wrangler to "${expectedWrangler}" (exact, no ^).`,
			"Then run `bun install`.",
		]);
	}

	if (overrideMiniflare !== expectedMiniflare) {
		fail("Miniflare is not overridden to the @cloudflare/vite-plugin runtime.", [
			`@cloudflare/vite-plugin ${cfVite.version} expects miniflare ${expectedMiniflare}.`,
			`Root overrides.miniflare is ${overrideMiniflare ?? "(missing)"}.`,
			`Set package.json overrides.miniflare to "${expectedMiniflare}".`,
			"Then run `bun install`.",
		]);
	}

	const webWrangler = readJson(
		firstExistingPackageJson(
			["apps/web/node_modules/wrangler", "node_modules/wrangler"],
			"wrangler (web)",
		),
	);
	if (webWrangler.version !== expectedWrangler) {
		fail("Wrangler on disk does not match @cloudflare/vite-plugin.", [
			`@cloudflare/vite-plugin expects wrangler ${expectedWrangler}.`,
			`Resolved wrangler is ${webWrangler.version}.`,
			"Run `bun install` after fixing package.json.",
		]);
	}

	/* Root `overrides.miniflare` + devDependency pin the repo’s Miniflare. With Bun’s isolated
	 * linker, `alchemy` may still resolve a nested copy under node_modules/.bun; that duplicate
	 * does not change the override we enforce here. */
	const rootMiniflarePkg = join(root, "node_modules/miniflare/package.json");
	if (!existsSync(rootMiniflarePkg)) {
		fail("Root node_modules/miniflare is missing.", [
			"Add miniflare to the root package (e.g. catalog + devDependency) matching @cloudflare/vite-plugin,",
			"and run `bun install`.",
		]);
	}
	const rootMiniflare = readJson(rootMiniflarePkg);
	if (rootMiniflare.version !== expectedMiniflare) {
		fail("Root Miniflare does not match @cloudflare/vite-plugin.", [
			`@cloudflare/vite-plugin expects miniflare ${expectedMiniflare}.`,
			`node_modules/miniflare is ${rootMiniflare.version}.`,
			"Set overrides.miniflare and workspaces.catalog.miniflare to that exact version, then `bun install`.",
		]);
	}

	try {
		await runAlchemyStatePasswordPreflight(root);
	} catch (e) {
		console.error(e);
		process.exit(1);
	}

	console.log(
		`[dev:preflight] Cloudflare local runtime aligned: wrangler ${expectedWrangler}, miniflare ${expectedMiniflare}.`,
	);
}

void main().catch((e) => {
	console.error(e);
	process.exit(1);
});
