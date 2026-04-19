/**
 * Discovers worker packages that have wrangler.jsonc.hbs under apps/ and durable-objects/.
 * Used by generate-wrangler and setup wizards so adding/removing workers does not require editing bootstrappers.
 */
import fs from "node:fs";
import path from "node:path";

export type Mode = "local" | "remote";

export type WorkerCatalogEntry = {
	/** Relative path such as apps/web or durable-objects/example-do */
	packageRelDir: string;
	/** Env var name such as WEB_WORKER_NAME */
	envKey: string;
	/** Short label for prompts */
	label: string;
	defaultProdScriptName: string;
	defaultLocalScriptName: string;
};

const HBS = "wrangler.jsonc.hbs";

function folderToWorkerNameEnvSegment(folder: string): string {
	return folder.replace(/-/g, "_").toUpperCase();
}

/**
 * Env key for WORKER_NAME template substitution: apps/web maps to WEB_WORKER_NAME;
 * other apps and durable-objects use UPPER_SNAKE from the folder name plus _WORKER_NAME.
 */
export function workerNameEnvKeyForPackageDir(packageRelDir: string): string {
	if (packageRelDir === "apps/web") {
		return "WEB_WORKER_NAME";
	}
	const appM = /^apps\/([^/]+)$/.exec(packageRelDir);
	if (appM) {
		const folder = appM[1];
		return `${folderToWorkerNameEnvSegment(folder)}_WORKER_NAME`;
	}
	const m = /^durable-objects\/([^/]+)$/.exec(packageRelDir);
	if (m) {
		const folder = m[1];
		return `${folderToWorkerNameEnvSegment(folder)}_WORKER_NAME`;
	}
	throw new Error(`Unknown package directory for wrangler template: ${packageRelDir}`);
}

export function defaultScriptNameForPackage(packageRelDir: string, mode: Mode): string {
	if (packageRelDir === "apps/web") {
		return mode === "local" ? "cf-web-app-dev" : "cf-web-app";
	}
	const appM = /^apps\/([^/]+)$/.exec(packageRelDir);
	if (appM) {
		const folder = appM[1];
		return mode === "local" ? `cf-${folder}-dev` : `cf-${folder}`;
	}
	const m = /^durable-objects\/([^/]+)$/.exec(packageRelDir);
	if (m) {
		const folder = m[1];
		return mode === "local" ? `cf-${folder}-dev` : `cf-${folder}`;
	}
	throw new Error(`Unknown package directory: ${packageRelDir}`);
}

function listTemplatePackageDirs(repoRoot: string): string[] {
	const out: string[] = [];
	for (const base of ["apps", "durable-objects"]) {
		const basePath = path.join(repoRoot, base);
		if (!fs.existsSync(basePath)) {
			continue;
		}
		for (const entry of fs.readdirSync(basePath, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}
			const rel = `${base}/${entry.name}`;
			if (fs.existsSync(path.join(repoRoot, rel, HBS))) {
				out.push(rel);
			}
		}
	}
	return out;
}

/**
 * Stable order: apps/web first, then other apps, then durable-objects (alphabetically within each group).
 */
export function getWorkerCatalog(repoRoot: string): WorkerCatalogEntry[] {
	const dirs = listTemplatePackageDirs(repoRoot);
	const web = dirs.filter((d) => d === "apps/web");
	const otherApps = dirs
		.filter((d) => d.startsWith("apps/") && d !== "apps/web")
		.sort((a, b) => a.localeCompare(b));
	const dos = dirs
		.filter((d) => d.startsWith("durable-objects/"))
		.sort((a, b) => a.localeCompare(b));
	const ordered = [...web, ...otherApps, ...dos];

	return ordered.map((packageRelDir) => {
		const envKey = workerNameEnvKeyForPackageDir(packageRelDir);
		const label =
			packageRelDir === "apps/web"
				? "apps/web (main worker)"
				: packageRelDir.startsWith("durable-objects/")
					? `${packageRelDir} (Durable Object)`
					: `${packageRelDir} (worker)`;
		let defaultProdScriptName = defaultScriptNameForPackage(packageRelDir, "remote");
		let defaultLocalScriptName = defaultScriptNameForPackage(packageRelDir, "local");
		const literal = tryLiteralWorkerNameFromHbs(repoRoot, packageRelDir);
		if (literal !== null) {
			defaultProdScriptName = literal;
			defaultLocalScriptName = `${literal}-dev`;
		}
		return {
			packageRelDir,
			envKey,
			label,
			defaultProdScriptName,
			defaultLocalScriptName,
		};
	});
}

/** Best-effort: top-level "name" literal string in wrangler JSONC template (ignored if value contains template braces). */
function tryLiteralWorkerNameFromHbs(repoRoot: string, packageRelDir: string): string | null {
	const p = path.join(repoRoot, packageRelDir, HBS);
	if (!fs.existsSync(p)) {
		return null;
	}
	let content: string;
	try {
		content = fs.readFileSync(p, "utf8");
	} catch {
		return null;
	}
	const m = /"name"\s*:\s*"([^"]+)"/.exec(content);
	if (!m) {
		return null;
	}
	const name = m[1].trim();
	if (name.includes("{{")) {
		return null;
	}
	return name || null;
}

const ROUTE_KEYS = ["ROUTES", "ROUTES_ZONE_NAME"] as const;

/** Keys merged from repo-root .env.production for remote wrangler (routes + worker name keys from catalog). */
export function getDeploymentKeys(repoRoot: string): string[] {
	const workerKeys = getWorkerCatalog(repoRoot).map((e) => e.envKey);
	return [...ROUTE_KEYS, ...workerKeys];
}

export function buildProdDefaults(repoRoot: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const e of getWorkerCatalog(repoRoot)) {
		out[e.envKey] = e.defaultProdScriptName;
	}
	return out;
}

export function buildLocalDefaults(repoRoot: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const e of getWorkerCatalog(repoRoot)) {
		out[e.envKey] = e.defaultLocalScriptName;
	}
	return out;
}

/** Worker name env keys only (no ROUTES). */
export function getWorkerNameEnvKeys(repoRoot: string): string[] {
	return getWorkerCatalog(repoRoot).map((e) => e.envKey);
}
